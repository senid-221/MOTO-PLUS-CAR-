import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AdminUserList } from '@seremoto/shared-types';
import { type AdminUserListQueryDto, adminUserListQuerySchema } from '@seremoto/validation';
import { RequirePermissions } from '../../common/security/decorators';
import { JwtAuthGuard } from '../../common/security/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AdminUsersService } from './admin-users.service';

/**
 * Staff user directory. Guarded by `admin:user:read`, which the permission
 * catalog gives only to the support and admin personas — a customer, rider or
 * merchant token is refused with FORBIDDEN even though it is a valid session.
 */
@Controller('admin/users')
@UseGuards(JwtAuthGuard)
@RequirePermissions('admin:user:read')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(adminUserListQuerySchema, 'query')) query: AdminUserListQueryDto,
  ): Promise<AdminUserList> {
    return this.users.list(query);
  }
}
