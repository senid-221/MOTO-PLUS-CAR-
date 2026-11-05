import type { AccountStatus, UserRole } from './enums';
import type { Paginated } from './api';

/**
 * One row of the staff user directory. Phone numbers are shown in the stored
 * E.164 form because support and verification work against that value, not a
 * locally formatted one.
 */
export interface AdminUserRow {
  id: string;
  fullName: string;
  phone: string;
  preferredLanguage: string;
  status: AccountStatus;
  roles: UserRole[];
  phoneVerified: boolean;
  /** Sessions that are active right now, counted from the session table. */
  activeSessions: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export type AdminUserList = Paginated<AdminUserRow>;

export interface AdminUserQuery {
  page: number;
  limit: number;
  role?: UserRole;
  status?: AccountStatus;
  search?: string;
}
