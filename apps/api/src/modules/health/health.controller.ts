import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { HealthStatus } from '@seremoto/shared-types';
import { Public } from '../../common/security/decorators';
import { PrismaService } from '../../common/database/prisma.service';
import { API_VERSION, SERVICE_NAME } from '../../version';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness plus a real database round trip; returns 503 when Postgres is down. */
  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthStatus> {
    const database = await this.prisma.isHealthy();
    if (!database) res.status(503);
    return {
      status: database ? 'ok' : 'degraded',
      service: SERVICE_NAME,
      version: API_VERSION,
      database: database ? 'up' : 'down',
      time: new Date().toISOString(),
    };
  }
}
