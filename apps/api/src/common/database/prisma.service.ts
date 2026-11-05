import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@seremoto/prisma-client';

/**
 * The single Prisma connection used by every module. PostgreSQL is the
 * authoritative source of business records; nothing here caches writes.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Used by the health endpoint to prove the database is reachable. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn(`Database health check failed: ${(error as Error).message}`);
      return false;
    }
  }
}
