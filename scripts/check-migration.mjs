#!/usr/bin/env node
/**
 * Guards against the schema and the committed migration drifting apart.
 *
 * `prisma migrate deploy` applies what is in prisma/migrations, while the
 * generated client is built from prisma/schema.prisma. If the two disagree, the
 * application boots and then fails on the first query that touches a column
 * nobody created. Regenerating the initial migration from the schema and
 * comparing it with the committed SQL catches that without a database, so it
 * runs in CI and in `pnpm run verify`.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationFile = join(root, 'prisma', 'migrations', '0_init', 'migration.sql');
const require = createRequire(import.meta.url);

/** Prisma's CLI entry, resolved from this workspace rather than a global install. */
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

/** Prisma emits an extra trailing blank line; line endings vary by platform. */
function normalize(sql) {
  return sql.replace(/\r\n/g, '\n').replace(/\n+$/, '\n');
}

function run(args) {
  // Node is spawned directly with the CLI script, so no shell is involved and
  // the same call works on Windows, macOS and the Linux CI runner.
  const result = spawnSync(process.execPath, [prismaCli(), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

try {
  // The datasource url is read from .env but never contacted: this diff is
  // computed entirely from the schema file.
  const generated = normalize(
    run([
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--script',
    ]),
  );
  const committed = normalize(readFileSync(migrationFile, 'utf8'));

  if (generated !== committed) {
    const generatedLines = generated.split('\n');
    const committedLines = committed.split('\n');
    const extra = generatedLines.filter(
      (line) => line.length > 0 && !committedLines.includes(line),
    );
    const missing = committedLines.filter(
      (line) => line.length > 0 && !generatedLines.includes(line),
    );

    console.error('prisma/migrations/0_init/migration.sql does not match prisma/schema.prisma.');
    if (extra.length) console.error(`Statements only in the schema:\n${extra.join('\n')}`);
    if (missing.length) console.error(`Statements only in the migration:\n${missing.join('\n')}`);
    console.error(
      'Create a new migration with `pnpm prisma migrate dev` instead of editing 0_init by hand.',
    );
    process.exitCode = 1;
  } else {
    const statements = committed.split(';').filter((part) => part.trim().length > 0).length;
    console.log(`Migration 0_init matches the schema (${statements} statements).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
