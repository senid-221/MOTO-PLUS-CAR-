/**
 * Development and test seed.
 *
 * Scope is deliberately narrow: it creates the accounts that the authentication
 * and permission tests need to sign in as, and nothing else. Pricing, commission
 * rates, service coverage and every other operating figure are business
 * decisions owned by operations through the admin API — inventing them here
 * would put fake production records in a live database.
 *
 * Safety:
 * - Refuses to run when NODE_ENV is production or staging.
 * - Idempotent: rows are upserted on the unique phone, so a re-run updates the
 *   same accounts instead of piling up duplicates.
 * - Phone numbers come from SEED_PHONE_PREFIX so the operator controls which
 *   numbers exist. The default is a clearly-flagged placeholder range and is
 *   printed on every run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AccountStatus, PrismaClient, UserRole } from '@seremoto/prisma-client';

interface SeedAccount {
  readonly label: string;
  readonly fullName: string;
  readonly preferredLanguage: 'rw' | 'en';
  readonly roles: readonly UserRole[];
}

/**
 * One account per self-service sign-up role, plus the staff personas that a
 * person cannot grant to themselves. Roles are exactly what
 * `permissionsForRoles` reads, so this is also the RBAC fixture.
 */
const ACCOUNTS: readonly SeedAccount[] = [
  {
    label: 'customer',
    fullName: 'Uwimana Aline',
    preferredLanguage: 'rw',
    roles: [UserRole.CUSTOMER],
  },
  {
    label: 'rider',
    fullName: 'Nshimiyimana Jean',
    preferredLanguage: 'rw',
    roles: [UserRole.RIDER],
  },
  {
    label: 'merchant',
    fullName: 'Mugisha Claude',
    preferredLanguage: 'rw',
    roles: [UserRole.MERCHANT],
  },
  {
    label: 'garage',
    fullName: 'Innocent Haruna',
    preferredLanguage: 'en',
    roles: [UserRole.GARAGE],
  },
  {
    label: 'support',
    fullName: 'Keza Support Desk',
    preferredLanguage: 'en',
    roles: [UserRole.SUPPORT],
  },
  {
    label: 'verification',
    fullName: 'Mukamana Verification Desk',
    preferredLanguage: 'en',
    roles: [UserRole.VERIFICATION_OFFICER],
  },
  {
    label: 'finance',
    fullName: 'Ndayisaba Finance Desk',
    preferredLanguage: 'en',
    roles: [UserRole.FINANCE],
  },
  {
    label: 'admin',
    fullName: 'Seed Administrator',
    preferredLanguage: 'en',
    roles: [UserRole.ADMIN],
  },
] as const;

/** Last digits appended to the prefix, so account order stays stable. */
const PHONE_SUFFIXES = ['01', '02', '03', '04', '05', '06', '07', '08'] as const;

const DEFAULT_PHONE_PREFIX = '+2507880000';

function assertEnvironmentIsSafeToSeed(): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production' || nodeEnv === 'staging') {
    throw new Error(
      `Refusing to seed a ${nodeEnv} database. Operating data must be entered through the admin API so it is attributable and auditable.`,
    );
  }
}

function phoneFor(index: number, prefix: string): string {
  const suffix = PHONE_SUFFIXES[index];
  if (suffix === undefined) {
    throw new Error(`No phone suffix configured for seed account ${index}.`);
  }
  return `${prefix}${suffix}`;
}

async function main(): Promise<void> {
  assertEnvironmentIsSafeToSeed();

  const prefix = process.env.SEED_PHONE_PREFIX ?? DEFAULT_PHONE_PREFIX;
  const created: string[] = [];

  for (const [index, account] of ACCOUNTS.entries()) {
    const phone = phoneFor(index, prefix);
    const roles = [...account.roles];

    const row = await prisma.user.upsert({
      where: { phone },
      update: {
        fullName: account.fullName,
        preferredLanguage: account.preferredLanguage,
        status: AccountStatus.ACTIVE,
        // A seeded account is treated as an already-verified phone so the auth
        // tests can start from a signed-in state instead of an SMS stand-in.
        phoneVerifiedAt: new Date(),
        roles,
      },
      create: {
        phone,
        fullName: account.fullName,
        preferredLanguage: account.preferredLanguage,
        status: AccountStatus.ACTIVE,
        phoneVerifiedAt: new Date(),
        roles,
      },
    });

    created.push(`${account.label.padEnd(13)} ${row.phone}  ${roles.join(', ')}`);
  }

  // Counted from the database, never assumed, so the summary cannot drift from
  // what the run actually did.
  const activeUsers = await prisma.user.count({ where: { status: AccountStatus.ACTIVE } });

  console.log(`Seeded ${created.length} accounts with prefix ${prefix}:`);
  for (const line of created) console.log(`  ${line}`);
  console.log(`ACTIVE users in this database now: ${activeUsers}`);
  console.log(
    'No pricing, commission, service-area or booking data was written — those belong to operations.',
  );
}

/**
 * `pnpm run db:seed` is executed from the repository root. Prisma takes
 * DATABASE_URL from the environment, which a plain shell does not have unless
 * the operator exported it — so load the untracked .env here first. Values the
 * environment already set win, which keeps CI (it exports the variables
 * itself) working without a .env file.
 */
function loadLocalEnvFile(): void {
  const file = join(process.cwd(), '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const name = match[1];
    const rawValue = match[2];
    if (name === undefined || rawValue === undefined) continue;
    if (process.env[name] !== undefined) continue;
    process.env[name] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

loadLocalEnvFile();

if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.length === 0) {
  throw new Error(
    'DATABASE_URL is not set and .env has no value for it. Copy .env.example to .env at the ' +
      'repository root, fill in the PostgreSQL connection string, then run pnpm run db:seed.',
  );
}

const prisma = new PrismaClient();

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
