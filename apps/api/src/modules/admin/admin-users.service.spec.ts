import { AdminUsersService } from './admin-users.service';
import type { PrismaService } from '../../common/database/prisma.service';

interface Row {
  id: string;
  fullName: string;
  phone: string;
  preferredLanguage: string;
  status: string;
  roles: string[];
  phoneVerifiedAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  sessions: { id: string }[];
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: '0f9d1c2e-0000-4000-8000-000000000001',
    fullName: 'Uwimana Aline',
    phone: '+250788000001',
    preferredLanguage: 'rw',
    status: 'ACTIVE',
    roles: ['CUSTOMER'],
    phoneVerifiedAt: new Date('2026-01-05T10:00:00.000Z'),
    createdAt: new Date('2026-01-05T10:00:00.000Z'),
    lastLoginAt: null,
    sessions: [{ id: 'session-1' }],
    ...overrides,
  };
}

function build(rows: Row[], total = rows.length) {
  const findMany = jest.fn(async (_args: Record<string, unknown>) => rows);
  const count = jest.fn(async (_args: Record<string, unknown> = {}) => total);
  const prisma = { user: { findMany, count } } as unknown as PrismaService;
  return { service: new AdminUsersService(prisma), findMany, count };
}

/** The first argument passed to the nth Prisma call, for where-clause assertions. */
function firstArg(call: [Record<string, unknown>?] | undefined): Record<string, unknown> {
  return call?.[0] ?? {};
}

const baseQuery = { page: 1, limit: 20 };

describe('AdminUsersService.list', () => {
  it('returns the rows the database gave, with a live session count', async () => {
    const { service } = build([row(), row({ id: 'x', sessions: [] })]);

    const result = await service.list(baseQuery);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      phone: '+250788000001',
      phoneVerified: true,
      activeSessions: 1,
      lastLoginAt: null,
    });
    expect(result.items[1]).toMatchObject({ activeSessions: 0 });
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('paginates with skip and take derived from the query', async () => {
    const { service, findMany } = build([], 45);

    const result = await service.list({ page: 3, limit: 20 });

    const args = firstArg(findMany.mock.calls[0]) as { skip: number; take: number };
    expect(args.skip).toBe(40);
    expect(args.take).toBe(20);
    expect(result.meta).toEqual({ page: 3, limit: 20, total: 45, totalPages: 3 });
  });

  it('hides deleted accounts unless staff ask for that status', async () => {
    const { service, findMany, count } = build([]);

    await service.list(baseQuery);
    const defaulted = firstArg(findMany.mock.calls[0]) as { where: { status: unknown } };
    expect(defaulted.where.status).toEqual({ not: 'DELETED' });

    await service.list({ ...baseQuery, status: 'DELETED' });
    const filtered = firstArg(count.mock.calls[1]) as { where: { status: unknown } };
    expect(filtered.where.status).toBe('DELETED');
  });

  it('filters by role and searches name or phone digits', async () => {
    const { service, findMany } = build([]);

    await service.list({ ...baseQuery, role: 'RIDER', search: '0788 000 001' });

    const args = firstArg(findMany.mock.calls[0]) as {
      where: { roles: unknown; OR: { phone: { endsWith: string } }[] };
    };
    expect(args.where.roles).toEqual({ has: 'RIDER' });
    expect(args.where.OR?.[1]?.phone.endsWith).toBe('0788000001');
  });

  it('never reports a total that the count query did not return', async () => {
    const { service } = build([], 0);

    const result = await service.list(baseQuery);

    expect(result.items).toEqual([]);
    expect(result.meta.totalPages).toBe(0);
  });
});
