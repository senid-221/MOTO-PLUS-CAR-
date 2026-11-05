import { Injectable } from '@nestjs/common';
import {
  AccountStatus as DbAccountStatus,
  SessionStatus as DbSessionStatus,
  type Prisma,
} from '@seremoto/prisma-client';
import type { AdminUserList, AdminUserQuery, AdminUserRow } from '@seremoto/shared-types';
import { PrismaService } from '../../common/database/prisma.service';

/** Sessions counted as live for the directory row. */
const LIVE_SESSION_STATUS: DbSessionStatus = DbSessionStatus.ACTIVE;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reads the directory straight from PostgreSQL. Nothing here is cached or
   * summarised in advance, so a dashboard can never show a figure the database
   * does not agree with.
   */
  async list(query: AdminUserQuery): Promise<AdminUserList> {
    const where = this.buildWhere(query);
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          fullName: true,
          phone: true,
          preferredLanguage: true,
          status: true,
          roles: true,
          phoneVerifiedAt: true,
          createdAt: true,
          lastLoginAt: true,
          sessions: {
            where: { status: LIVE_SESSION_STATUS, expiresAt: { gt: new Date() } },
            select: { id: true },
          },
        },
      }),
    ]);

    const items: AdminUserRow[] = rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      phone: row.phone,
      preferredLanguage: row.preferredLanguage,
      status: row.status as AdminUserRow['status'],
      roles: row.roles as AdminUserRow['roles'],
      phoneVerified: row.phoneVerifiedAt !== null,
      activeSessions: row.sessions.length,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    }));

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  private buildWhere(query: AdminUserQuery): Prisma.UserWhereInput {
    const search = query.search;
    return {
      // A deleted account is kept for financial audit but leaves the working
      // directory unless staff filter for that status explicitly.
      status: query.status ?? { not: DbAccountStatus.DELETED },
      ...(query.role ? { roles: { has: query.role } } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { phone: { endsWith: search.replace(/\D/g, '') || search } },
            ],
          }
        : {}),
    };
  }
}
