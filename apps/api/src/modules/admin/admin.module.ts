import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { IdentityModule } from '../identity/identity.module';

@Module({
  // IdentityModule exports TokenService, which JwtAuthGuard needs to verify the
  // bearer token this controller's guard reads.
  imports: [IdentityModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminModule {}
