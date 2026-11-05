import { z } from 'zod';
import { ACCOUNT_STATUSES, USER_ROLES } from '@seremoto/shared-types';
import { paginationSchema } from './pagination';

/**
 * Query string for the staff user directory. Every filter is optional, and the
 * free-text search is bounded so a dashboard cannot ask the database for a
 * unbounded scan.
 */
export const adminUserListQuerySchema = paginationSchema.extend({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  search: z.string().trim().min(1).max(60).optional(),
});

export type AdminUserListQueryDto = z.infer<typeof adminUserListQuerySchema>;
