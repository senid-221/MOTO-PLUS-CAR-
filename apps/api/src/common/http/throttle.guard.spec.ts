import { type Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ThrottleGuard, type ThrottleOptions } from './throttle.guard';
import { RateLimitedError } from './api-error';

class Handler {}

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request as unknown as Request }),
    getHandler: () => Handler,
    getClass: () => class Controller {},
  };
}

function build(options: ThrottleOptions | null) {
  const reflector = {
    getAllAndOverride: jest.fn(() => options),
  } as unknown as Reflector;
  return new ThrottleGuard(reflector);
}

describe('ThrottleGuard', () => {
  it('lets routes without a throttle rule through untouched', () => {
    const guard = build(null);
    expect(guard.canActivate(contextFor({ ip: '41.74.10.5' }) as never)).toBe(true);
  });

  it('allows exactly the configured number of requests in a window', () => {
    const guard = build({ limit: 3, windowSeconds: 60, by: 'ip' });
    const request = contextFor({
      ip: '41.74.10.5',
      headers: {},
      socket: { remoteAddress: '41.74.10.5' },
    });
    for (let i = 0; i < 3; i += 1) {
      expect(guard.canActivate(request as never)).toBe(true);
    }
    expect(() => guard.canActivate(request as never)).toThrow(RateLimitedError);
  });

  it('counts per phone number so one victim is not locked out by another caller', () => {
    const guard = build({ limit: 1, windowSeconds: 60, by: 'phone' });
    const a = contextFor({ body: { phone: '+250788111111' }, headers: {}, ip: '1.1.1.1' });
    const b = contextFor({ body: { phone: '+250788222222' }, headers: {}, ip: '1.1.1.1' });
    expect(guard.canActivate(a as never)).toBe(true);
    expect(guard.canActivate(b as never)).toBe(true);
    expect(() => guard.canActivate(a as never)).toThrow(RateLimitedError);
  });

  it('uses the forwarded client address behind a proxy, not the load balancer', () => {
    const guard = build({ limit: 1, windowSeconds: 60, by: 'ip' });
    const first = contextFor({
      headers: { 'x-forwarded-for': '197.232.10.10, 10.0.0.1' },
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' },
    });
    const second = contextFor({
      headers: { 'x-forwarded-for': '197.232.10.11, 10.0.0.1' },
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' },
    });
    expect(guard.canActivate(first as never)).toBe(true);
    expect(guard.canActivate(second as never)).toBe(true);
    expect(() => guard.canActivate(first as never)).toThrow(RateLimitedError);
  });

  it('opens a fresh window once the old one expires', () => {
    jest.useFakeTimers();
    try {
      const guard = build({ limit: 1, windowSeconds: 60, by: 'ip' });
      const request = contextFor({
        ip: '41.74.10.5',
        headers: {},
        socket: { remoteAddress: '41.74.10.5' },
      });
      expect(guard.canActivate(request as never)).toBe(true);
      expect(() => guard.canActivate(request as never)).toThrow(RateLimitedError);
      jest.setSystemTime(Date.now() + 61_000);
      expect(guard.canActivate(request as never)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('forgets the counters on reset, which the test hooks and a deploy use', () => {
    const guard = build({ limit: 1, windowSeconds: 60, by: 'ip' });
    const request = contextFor({ ip: '41.74.10.5', headers: {} });
    expect(guard.canActivate(request as never)).toBe(true);
    expect(() => guard.canActivate(request as never)).toThrow(RateLimitedError);
    guard.reset();
    expect(guard.canActivate(request as never)).toBe(true);
  });
});
