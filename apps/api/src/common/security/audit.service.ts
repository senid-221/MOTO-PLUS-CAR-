import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@seremoto/prisma-client';
import { PrismaService } from '../../common/database/prisma.service';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Audit trail for authentication and administrative activity.
 *
 * `record` is best effort: a failed login audit row must not mask the original
 * authentication error. `recordStrict` is used by privileged actions where a
 * missing audit record is itself a compliance failure.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    try {
      await this.write(input);
    } catch (error) {
      this.logger.error(`Audit write failed for ${input.action}: ${(error as Error).message}`);
    }
  }

  async recordStrict(input: AuditInput): Promise<void> {
    await this.write(input);
  }

  private async write(input: AuditInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: input.before,
        after: input.after,
        metadata: input.metadata,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    });
  }
}
