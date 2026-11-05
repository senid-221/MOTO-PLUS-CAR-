import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthSession, SessionDeviceInfo } from '@seremoto/shared-types';
import {
  type RegisterDto,
  type SendOtpDto,
  type VerifyOtpDto,
  idParamSchema,
  loginSchema,
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from '@seremoto/validation';
import { CurrentUser, Public, RequirePermissions } from '../../common/security/decorators';
import type { AuthenticatedUser } from '../../common/security/decorators';
import { JwtAuthGuard } from '../../common/security/guards/jwt-auth.guard';
import { Throttle } from '../../common/http/throttle.guard';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  readCookie,
  serializeRefreshCookie,
} from '../../common/http/cookies';
import { NotFoundError, UnauthenticatedError } from '../../common/http/api-error';
import { AuditService } from '../../common/security/audit.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthService, type RequestMeta, type SessionOutcome } from './auth.service';
import { exposesDevOtp, type Environment } from '../../config/environment';
import { ENV_TOKEN } from '../../config/env.module';
import { SessionStatus } from '@seremoto/prisma-client';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV_TOKEN)
    private readonly env: Environment,
  ) {}

  private get cookieSecure(): boolean {
    return this.env.NODE_ENV === 'production' || this.env.NODE_ENV === 'staging';
  }

  private meta(req: Request): RequestMeta {
    return {
      userAgent: req.headers['user-agent'] ?? undefined,
      ipAddress: req.ip ?? null,
      exposeDevOtp: exposesDevOtp(this.env),
    };
  }

  /** Writes the rotating refresh token as an httpOnly cookie on auth responses. */
  private attachCookie(res: Response, outcome: SessionOutcome): void {
    res.appendHeader(
      'Set-Cookie',
      serializeRefreshCookie(outcome.refreshToken, {
        maxAgeSeconds: outcome.refreshTokenExpiresInSeconds,
        secure: this.cookieSecure,
      }),
    );
  }

  private clearCookie(res: Response): void {
    res.appendHeader('Set-Cookie', clearRefreshCookie(this.cookieSecure));
  }

  @Public()
  @Throttle({ limit: 10, windowSeconds: 600, by: 'phone' })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterDto, @Req() req: Request) {
    return this.auth.register(body, this.meta(req));
  }

  /**
   * Sign-in step one. `login` and `send-otp` are the same operation so the
   * documented endpoints in the specification both exist and behave the same.
   */
  @Public()
  @Throttle({ limit: 5, windowSeconds: 300, by: 'phone' })
  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) body: { phone: string }, @Req() req: Request) {
    return this.auth.sendLoginOtp(body.phone, this.meta(req));
  }

  @Public()
  @Throttle({ limit: 5, windowSeconds: 300, by: 'phone' })
  @Post('send-otp')
  sendOtp(@Body(new ZodValidationPipe(sendOtpSchema)) body: SendOtpDto, @Req() req: Request) {
    return this.auth.sendLoginOtp(body.phone, this.meta(req));
  }

  /**
   * Sign-in step two. Verifies the code, activates a pending account and opens
   * a session.
   */
  @Public()
  @Throttle({ limit: 15, windowSeconds: 300, by: 'phone' })
  @Post('verify-otp')
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) body: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const outcome = await this.auth.verifyOtp(body, this.meta(req));
    this.attachCookie(res, outcome);
    return outcome.session;
  }

  /**
   * Exchanges the refresh cookie for a new access token. The presented token is
   * revoked, so a stolen token cannot be replayed twice.
   */
  @Public()
  @Throttle({ limit: 30, windowSeconds: 300, by: 'ip' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const token = readCookie(req.headers.cookie, REFRESH_COOKIE_NAME);
    if (!token) {
      this.clearCookie(res);
      throw new UnauthenticatedError('No session to refresh. Log in again.');
    }
    const outcome = await this.auth.refresh(token, this.meta(req));
    this.attachCookie(res, outcome);
    return outcome.session;
  }

  /**
   * Public by design: an expired access token must not prevent a user from
   * ending the session held in their cookie.
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = readCookie(req.headers.cookie, REFRESH_COOKIE_NAME);
    let revoked = false;

    if (user?.userId && user.sessionId) {
      revoked = (await this.auth.logout(user.userId, user.sessionId, this.meta(req))).revoked;
    } else if (token) {
      revoked = await this.auth.logoutByRefreshToken(token, this.meta(req));
    }

    this.clearCookie(res);
    return { revoked };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.currentUser(user.userId);
  }

  @RequirePermissions('session:manage')
  @Get('sessions')
  async sessions(@CurrentUser() user: AuthenticatedUser): Promise<SessionDeviceInfo[]> {
    const rows = await this.prisma.session.findMany({
      where: {
        userId: user.userId,
        status: SessionStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, issuedAt: true, lastUsedAt: true, expiresAt: true, userAgent: true },
    });

    return rows.map((row) => ({
      sessionId: row.id,
      deviceLabel: row.userAgent ? describeAgent(row.userAgent) : null,
      createdAt: row.issuedAt.toISOString(),
      lastUsedAt: row.lastUsedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      current: row.id === user.sessionId,
    }));
  }

  @RequirePermissions('session:manage')
  @HttpCode(HttpStatus.OK)
  @Post('sessions/:id/revoke')
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(idParamSchema, 'params')) params: { id: string },
  ) {
    const session = await this.prisma.session.findFirst({
      where: { id: params.id, userId: user.userId },
      select: { id: true },
    });
    if (!session) throw new NotFoundError('Session not found');

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: user.sessionId === session.id ? 'USER_CURRENT' : 'USER_SELECTED',
      },
    });

    await this.audit.record({
      actorId: user.userId,
      action: 'auth.session.revoked',
      entityType: 'Session',
      entityId: session.id,
    });

    return { sessionId: session.id, revoked: true };
  }
}

/** Short human label for the session list, without storing the whole UA string. */
export function describeAgent(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Browser';
  const device = /Android|iPhone|iPad|Mobile/i.test(userAgent) ? 'Mobile' : 'Desktop';
  return `${device} · ${browser}`;
}
