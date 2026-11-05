#!/usr/bin/env node
/**
 * Runs the Prisma migrate commands with the variables the CLI insists on.
 *
 * `prisma/schema.prisma` declares `directUrl = env("DIRECT_DATABASE_URL")` so
 * that a pooled runtime connection (Neon or Supabase) can still be migrated
 * through the direct, non-pooled endpoint. Prisma validates every `env()`
 * reference in the datasource block before it does anything else, so a missing
 * variable fails the whole command with `P1012: Environment variable not
 * found` even when the migration itself would have worked.
 *
 * This wrapper gives DIRECT_DATABASE_URL a value — the one in the environment
 * or .env, otherwise DATABASE_URL — and then hands over to the real CLI.
 * Set DIRECT_DATABASE_URL to the direct endpoint whenever DATABASE_URL points
 * at a pooler; see docs/DATABASE.md.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const SCHEMA = join('prisma', 'schema.prisma');

/** Values from the untracked .env, used only when the process did not set them. */
function dotEnv() {
  const file = join(root, '.env');
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

function prismaCli() {
  try {
    return require.resolve('prisma');
  } catch {
    const fallback = join(root, 'node_modules', 'prisma', 'build', 'index.js');
    if (!existsSync(fallback)) {
      throw new Error('The prisma package is not installed; run pnpm install first.');
    }
    return fallback;
  }
}

const fromEnv = (name) => process.env[name] || dotEnv()[name] || '';

const databaseUrl = fromEnv('DATABASE_URL');
if (databaseUrl.length === 0) {
  console.error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill in the PostgreSQL ' +
      'connection string, or export DATABASE_URL before running this command.',
  );
  process.exit(1);
}

const directUrl = fromEnv('DIRECT_DATABASE_URL');
if (directUrl.length === 0) {
  process.env.DIRECT_DATABASE_URL = databaseUrl;
  console.error(
    'DIRECT_DATABASE_URL is unset; migrating through DATABASE_URL. Set it to the ' +
      'direct (non-pooled) endpoint when DATABASE_URL uses a connection pooler.',
  );
}

// Prisma's own output is streamed, so the migration log and any prompt behave
// exactly as they would from the raw CLI.
const args = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  [prismaCli(), 'migrate', ...(args.length > 0 ? args : ['deploy']), '--schema', SCHEMA],
  { cwd: root, stdio: 'inherit', env: process.env },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
