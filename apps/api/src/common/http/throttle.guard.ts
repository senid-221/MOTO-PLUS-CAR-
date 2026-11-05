import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RateLimitedError } from './api-error';

export const THROTTLE_KEY = 'sere:throttle';

export interface ThrottleOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Count per client IP, or per submitted phone number when present. */
  by: 'ip' | 'phone';
}

export const Throttle = (options: ThrottleOptions) => SetMetadata(THROTTLE_KEY, options);

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window limiter for the authentication endpoints, which are the ones an
 * attacker drives. State is per process: with more than one API instance the
 * limit becomes per instance, and this must be replaced by the Redis-backed
 * limiter before horizontal scaling. Stated in docs/SECURITY.md.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {
    // Expire bookkeeping so a long-lived process cannot grow this map forever.
    const timer = setInterval(() => this.sweep(), 60_000);
    timer.unref?.();
  }

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<ThrottleOptions>(THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const identity = options.by === 'phone' ? readPhone(request) : (clientIp(request) ?? 'unknown');
    const key = `${context.getHandler().name}:${options.by}:${identity}`;
    const now = Date.now();

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + options.windowSeconds * 1000 });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > options.limit) {
      throw new RateLimitedError();
    }
    return true;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  /** Exposed for tests. */
  reset(): void {
    this.buckets.clear();
  }
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return request.ip ?? request.socket?.remoteAddress ?? null;
}

function readPhone(request: Request): string {
  const body = request.body as { phone?: unknown } | undefined;
  const queryPhone = (request.query as { phone?: unknown } | undefined)?.phone;
  const value = typeof body?.phone === 'string' ? body.phone : queryPhone;
  return typeof value === 'string' && value.length > 0 ? value : (clientIp(request) ?? 'unknown');
}
