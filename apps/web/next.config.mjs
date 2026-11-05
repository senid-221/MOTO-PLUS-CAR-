import { fileURLToPath } from 'node:url';

/**
 * The browser only ever talks to this origin. The API host stays server-side:
 * the proxy under app/api/v1 keeps the refresh cookie first-party and stores the
 * access token in an httpOnly cookie instead of page JavaScript.
 *
 * API_BASE_URL and APP_WEB_URL are read from this app's .env files; see
 * .env.example. Defaults point at the local API on port 4000.
 */
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // A stray lockfile in the user's home directory would otherwise be picked as
  // the workspace root, and the deployed bundle would trace the wrong folder.
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
