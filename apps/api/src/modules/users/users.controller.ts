import { Body, Controller, Inject, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUserSummary } from '@seremoto/shared-types';
import { type UpdateProfileDto, updateProfileSchema } from '@seremoto/validation';
import { CurrentUser, RequirePermissions } from '../../common/security/decorators';
import type { AuthenticatedUser } from '../../common/security/decorators';
import { JwtAuthGuard } from '../../common/security/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AuthService } from '../identity/auth.service';
import { exposesDevOtp, type Environment } from '../../config/environment';
import { ENV_TOKEN } from '../../config/env.module';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV_TOKEN)
    private readonly env: Environment,
  ) {}

  @RequirePermissions('account:update')
  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileDto,
    @Req() req: Request,
  ): Promise<CurrentUserSummary> {
    return this.auth.updateProfile(user.userId, body, {
      userAgent: req.headers['user-agent'] ?? undefined,
      ipAddress: req.ip ?? null,
      exposeDevOtp: exposesDevOtp(this.env),
    });
  }
}
