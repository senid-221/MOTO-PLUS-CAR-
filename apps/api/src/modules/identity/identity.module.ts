import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { LogSmsProvider, SmsProviderRegistry } from './sms/sms.provider';
import { JwtAuthGuard } from '../../common/security/guards/jwt-auth.guard';
import { AuditService } from '../../common/security/audit.service';
import { ThrottleGuard } from '../../common/http/throttle.guard';
import { ENV_TOKEN } from '../../config/env.module';
import type { Environment } from '../../config/environment';

/**
 * Identity domain: registration, OTP, sessions, roles and the guards every
 * other domain relies on. Guards are bound as global so a route is protected
 * unless it is explicitly marked @Public().
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV_TOKEN],
      useFactory: (env: Environment) => ({
        secret: env.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: env.ACCESS_TOKEN_TTL, algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    AuditService,
    LogSmsProvider,
    JwtAuthGuard,
    {
      provide: SmsProviderRegistry,
      useFactory: (log: LogSmsProvider) => new SmsProviderRegistry([log]),
      inject: [LogSmsProvider],
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottleGuard },
  ],
  exports: [AuthService, TokenService, OtpService, AuditService, JwtAuthGuard],
})
export class IdentityModule {}
