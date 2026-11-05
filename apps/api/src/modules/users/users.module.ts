import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [IdentityModule],
  controllers: [UsersController],
})
export class UsersModule {}
