/**
 * Display helpers that stay honest about what the backend returned.
 *
 * `formatPhone` only rewrites the dialling form of a number the API already gave
 * back (E.164 → the local 078 123 4567 a Rwandan dialler expects), and role
 * labels fall back to the real role name instead of inventing copy for personas
 * the dictionaries do not cover yet — staff portals are a later milestone.
 */
import type { UserRole } from '@seremoto/shared-types';
import { normalizePhone } from '@seremoto/validation';
import type { Translate, TranslationKey } from '@/messages';

const ROLE_KEYS: Partial<Record<UserRole, TranslationKey>> = {
  CUSTOMER: 'auth.role.customer',
  RIDER: 'auth.role.rider',
  MERCHANT: 'auth.role.merchant',
  GARAGE: 'auth.role.garage',
  COOPERATIVE_MANAGER: 'auth.role.cooperative',
  BUSINESS_CLIENT: 'auth.role.business',
};

/** +250781234567 → "078 123 4567". Returns the input when it is not a Rwandan number. */
export function formatPhone(e164: string): string {
  const normalized = normalizePhone(e164);
  if (!normalized) return e164;
  const local = `0${normalized.national}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** "SUPER_ADMIN" reads as "Super admin" when no dictionary label exists. */
function humanize(role: UserRole): string {
  const words = role.split('_').map((word) => word.toLowerCase());
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export function roleLabel(role: UserRole, t: Translate): string {
  const key = ROLE_KEYS[role];
  return key ? t(key) : humanize(role);
}
