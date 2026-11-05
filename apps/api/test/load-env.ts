import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Loads the repository .env for test runs without adding a dotenv dependency.
 * Values already present in the environment win, so CI secrets are never
 * overwritten by a checked-out local file.
 */
const candidates = [
  join(__dirname, '..', '..', '..', '.env'),
  join(process.cwd(), '.env'),
  join(process.cwd(), '..', '..', '.env'),
];

for (const file of candidates) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if (process.env[key] === undefined) process.env[key] = value;
  }
  break;
}

if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
