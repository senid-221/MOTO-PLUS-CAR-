import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { EnvModule } from './config/env.module';
import { PrismaModule } from './common/database/prisma.module';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { ApiResponseInterceptor } from './common/http/api-response.interceptor';
import { IdentityModule } from './modules/identity/identity.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';

/**
 * Modular monolith. Each domain is one NestJS module with its own services;
 * they talk through service interfaces and domain events rather than reaching
 * into each other's tables. Splitting a module into a service is a later
 * decision, not a precondition for shipping.
 */
@Module({
  imports: [EnvModule, PrismaModule, IdentityModule, UsersModule, AdminModule, HealthModule],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
