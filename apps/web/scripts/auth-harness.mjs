/**
 * Web-layer journey harness.
 *
 * WHAT THIS IS. The real NestJS API needs PostgreSQL, and this repository has no
 * database URL yet, so the full sign-up journey cannot run against it. This
 * script therefore boots the *built* Next.js app (`next start`) against a
 * stand-in HTTP server that speaks the documented API envelope: the same status
 * codes, the same { success, data, message } shape, the same Set-Cookie
 * attributes on the refresh cookie, and Bearer checks on protected routes.
 *
 * WHAT IT ACTUALLY TESTS. Every assertion below is about this app's own code:
 * the same-origin proxy, the httpOnly access-token capture, cookie pass-through,
 * the language cookie, the page shells and the 502 path. It never claims to
 * prove the API, the OTP rules, or the database — those stay unverified until a
 * DATABASE_URL exists.
 *
 * Usage: pnpm --filter @seremoto/web build && node scripts/auth-harness.mjs
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const appDir = fileURLToPath(new URL('..', import.meta.url));
const nextBin = require.resolve('next/dist/bin/next');

const STUB_PORT = 4111;
const WEB_PORT = 3111;
const STUB_BASE = `http://127.0.0.1:${STUB_PORT}`;
const WEB_BASE = `http://127.0.0.1:${WEB_PORT}`;

const ACCESS_TOKEN = 'stub-access-token-value';
const REFRESH_TOKEN = 'stub-refresh-token-value';

const results = [];
const upstreamLog = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function jsonBody(data) {
  return JSON.stringify({ success: true, data, message: 'Operation completed successfully' });
}

function errorBody(code, message) {
  return JSON.stringify({ success: false, error: { code, message, details: [] } });
}

const REFRESH_COOKIE = `sere_refresh=${REFRESH_TOKEN}; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Max-Age=2592000`;

function sessionPayload() {
  return jsonBody({
    tokens: {
      accessToken: ACCESS_TOKEN,
      accessTokenExpiresInSeconds: 900,
      refreshTokenExpiresInSeconds: 2592000,
    },
    user: {
      id: 'user-1',
      fullName: 'Uwimana Eric',
      phone: '+250781234567',
      email: null,
      preferredLanguage: 'rw',
      status: 'ACTIVE',
      roles: ['CUSTOMER'],
      permissions: ['account:read', 'account:update', 'session:manage'],
      phoneVerified: true,
    },
  });
}

const userPayload = () =>
  jsonBody({
    id: 'user-1',
    fullName: 'Uwimana Eric',
    phone: '+250781234567',
    email: null,
    preferredLanguage: 'rw',
    status: 'ACTIVE',
    roles: ['CUSTOMER'],
    permissions: ['account:read', 'account:update', 'session:manage'],
    phoneVerified: true,
  });

function readBearer(req) {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function startStub() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        upstreamLog.push({
          method: req.method,
          path: req.url,
          authorization: req.headers.authorization ?? null,
          bearer: readBearer(req),
          cookie: req.headers.cookie ?? null,
          body: raw,
        });

        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.setHeader('cache-control', 'no-store');

        if (req.method === 'POST' && req.url === '/api/v1/auth/login') {
          res.writeHead(200);
          res.end(
            jsonBody({
              phone: '+250781234567',
              purpose: 'LOGIN',
              expiresInSeconds: 300,
              devOtpCode: '246813',
            }),
          );
          return;
        }

        if (req.method === 'POST' && req.url === '/api/v1/auth/register') {
          res.writeHead(201);
          res.end(
            jsonBody({
              userId: 'user-1',
              phone: '+250781234567',
              verificationRequired: true,
              purpose: 'REGISTER',
              expiresInSeconds: 300,
              devOtpCode: '135790',
            }),
          );
          return;
        }

        if (req.method === 'POST' && req.url === '/api/v1/auth/verify-otp') {
          const body = JSON.parse(raw || '{}');
          if (body.code !== '246813') {
            res.writeHead(401);
            res.end(errorBody('INVALID_OTP', 'Code does not match'));
            return;
          }
          res.setHeader('set-cookie', REFRESH_COOKIE);
          res.writeHead(200);
          res.end(sessionPayload());
          return;
        }

        if (req.method === 'POST' && req.url === '/api/v1/auth/refresh') {
          if (!/sere_refresh=/.test(req.headers.cookie ?? '')) {
            res.writeHead(401);
            res.end(errorBody('UNAUTHENTICATED', 'No session to refresh'));
            return;
          }
          res.setHeader('set-cookie', REFRESH_COOKIE);
          res.writeHead(200);
          res.end(sessionPayload());
          return;
        }

        if (req.method === 'GET' && req.url === '/api/v1/auth/me') {
          if (readBearer(req) !== ACCESS_TOKEN) {
            res.writeHead(401);
            res.end(errorBody('UNAUTHENTICATED', 'Missing or stale access token'));
            return;
          }
          res.writeHead(200);
          res.end(userPayload());
          return;
        }

        if (req.method === 'PATCH' && req.url === '/api/v1/users/profile') {
          if (readBearer(req) !== ACCESS_TOKEN) {
            res.writeHead(401);
            res.end(errorBody('UNAUTHENTICATED', 'Missing or stale access token'));
            return;
          }
          res.writeHead(200);
          res.end(userPayload());
          return;
        }

        if (req.method === 'POST' && req.url === '/api/v1/auth/logout') {
          res.setHeader(
            'set-cookie',
            'sere_refresh=; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Max-Age=0',
          );
          res.writeHead(200);
          res.end(jsonBody({ revoked: true }));
          return;
        }

        if (req.method === 'GET' && req.url === '/health') {
          res.writeHead(200);
          res.end(
            jsonBody({
              status: 'ok',
              service: 'stub',
              version: '0',
              database: 'up',
              time: new Date().toISOString(),
            }),
          );
          return;
        }

        res.writeHead(404);
        res.end(errorBody('NOT_FOUND', `No stub for ${req.method} ${req.url}`));
      });
    });

    server.listen(STUB_PORT, '127.0.0.1', () => resolve(server));
  });
}

async function waitForWeb(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${WEB_BASE}/`);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function cookiesOf(response) {
  return typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
}

function cookieHeader(cookies) {
  return cookies.map((line) => line.split(';')[0]).join('; ');
}

async function run() {
  const stub = await startStub();

  // Started as a plain node child (no shell wrapper) so killing it really stops
  // the server when the run finishes.
  const web = spawn(process.execPath, [nextBin, 'start', '-p', String(WEB_PORT)], {
    cwd: appDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      API_BASE_URL: `${STUB_BASE}/api/v1`,
      APP_WEB_URL: WEB_BASE,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let webOutput = '';
  web.stdout.on('data', (chunk) => (webOutput += chunk.toString()));
  web.stderr.on('data', (chunk) => (webOutput += chunk.toString()));

  if (!(await waitForWeb())) {
    console.log(webOutput);
    throw new Error('Next.js server did not become ready');
  }

  try {
    // 1. Default language is Kinyarwanda.
    const home = await fetch(`${WEB_BASE}/`);
    const homeHtml = await home.text();
    record(
      'home renders in Kinyarwanda by default',
      homeHtml.includes('Serivisi za moteri'),
      home.status,
    );
    record('home lists the real services', homeHtml.includes('Kohereza ipaketi'), undefined);

    // 2. The language cookie changes server-rendered copy.
    const localeSet = await fetch(`${WEB_BASE}/api/locale`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'en' }),
    });
    const localeCookies = cookiesOf(localeSet);
    record(
      'locale route writes a readable, year-long language cookie',
      localeSet.ok &&
        localeCookies.some(
          (c) => /sere_lang=en/.test(c) && !/HttpOnly/.test(c) && /Max-Age=31536000/.test(c),
        ),
      localeCookies.join(' | '),
    );
    const homeEn = await fetch(`${WEB_BASE}/`, { headers: { cookie: 'sere_lang=en' } });
    const homeEnHtml = await homeEn.text();
    record(
      'home renders English when the cookie says so',
      homeEnHtml.includes('Motorcycle services in one app'),
      undefined,
    );
    record(
      'html lang attribute follows the cookie',
      homeEnHtml.includes('<html lang="en"'),
      homeEnHtml.match(/<html lang="\w+"/)?.[0],
    );
    record(
      'rejects an unknown language',
      (
        await fetch(`${WEB_BASE}/api/locale`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ language: 'fr' }),
        })
      ).status === 400,
      undefined,
    );

    // 3. Login step one through the proxy.
    const login = await fetch(`${WEB_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '0781234567' }),
    });
    const loginJson = await login.json();
    record(
      'proxy forwards POST bodies and returns the API envelope',
      login.ok && loginJson.data?.purpose === 'LOGIN' && loginJson.data?.phone === '+250781234567',
      JSON.stringify(loginJson.data),
    );
    record(
      'the API saw a same-origin call with no cookie jar',
      upstreamLog.at(-1).cookie === null,
      upstreamLog.at(-1).cookie,
    );

    // 4. Sign-in step two: token capture into an httpOnly cookie.
    const verify = await fetch(`${WEB_BASE}/api/v1/auth/verify-otp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '+250781234567', code: '246813', purpose: 'LOGIN' }),
    });
    const verifyCookies = cookiesOf(verify);
    const verifyText = await verify.text();
    record(
      'access token is removed from the response body',
      !verifyText.includes(ACCESS_TOKEN) && !verifyText.includes('accessToken'),
      verifyText.slice(0, 80),
    );
    record(
      'access token arrives as an httpOnly, Lax, root-path cookie',
      verifyCookies.some(
        (c) =>
          c.startsWith('sere_access=') &&
          /HttpOnly/.test(c) &&
          /Path=\//.test(c) &&
          /SameSite=Lax/.test(c) &&
          /Max-Age=900/.test(c),
      ),
      verifyCookies.join(' | '),
    );
    record(
      'the API refresh cookie is forwarded untouched, scoped to auth routes',
      verifyCookies.some(
        (c) => /sere_refresh=/.test(c) && /Path=\/api\/v1\/auth/.test(c) && /HttpOnly/.test(c),
      ),
      undefined,
    );

    // 5. A protected call with only cookies gets the Bearer header injected.
    const jar = cookieHeader(verifyCookies);
    const me = await fetch(`${WEB_BASE}/api/v1/auth/me`, { headers: { cookie: jar } });
    const meJson = await me.json();
    record(
      'proxy supplies the access token from the cookie',
      me.ok && meJson.data?.phone === '+250781234567',
      undefined,
    );
    record(
      'the upstream received the bearer it demanded',
      upstreamLog.at(-1).bearer === ACCESS_TOKEN,
      upstreamLog.at(-1).authorization,
    );

    // 6. Without the cookie the API's 401 is passed through as an envelope.
    const anon = await fetch(`${WEB_BASE}/api/v1/auth/me`);
    const anonJson = await anon.json();
    record(
      'an unauthenticated call keeps the API error envelope',
      anon.status === 401 &&
        anonJson.success === false &&
        anonJson.error.code === 'UNAUTHENTICATED',
      JSON.stringify(anonJson.error?.code),
    );

    // 7. Refresh rotates and re-stores the token, still hidden from the body.
    const refresh = await fetch(`${WEB_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { cookie: jar },
    });
    const refreshText = await refresh.text();
    record(
      'refresh issues a fresh hidden token',
      refresh.ok &&
        !refreshText.includes(ACCESS_TOKEN) &&
        cookiesOf(refresh).some((c) => c.startsWith('sere_access=')),
      cookiesOf(refresh).join(' | '),
    );

    // 8. Profile update needs the bearer too (account screen).
    const patch = await fetch(`${WEB_BASE}/api/v1/users/profile`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: jar },
      body: JSON.stringify({ preferredLanguage: 'en' }),
    });
    record(
      'PATCH reaches the API with the injected bearer',
      patch.ok && upstreamLog.at(-1).bearer === ACCESS_TOKEN,
      undefined,
    );

    // 9. Logout clears the web-side access cookie.
    const logout = await fetch(`${WEB_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: jar },
    });
    const logoutCookies = cookiesOf(logout);
    record(
      'logout drops the access cookie with Max-Age=0',
      logout.ok && logoutCookies.some((c) => c.startsWith('sere_access=;') && /Max-Age=0/.test(c)),
      logoutCookies.join(' | '),
    );

    // 10. A request for a route the API does not have is not rewritten.
    const missing = await fetch(`${WEB_BASE}/api/v1/bookings`, {
      method: 'GET',
      headers: { cookie: jar },
    });
    record('unknown upstream routes keep the API 404', missing.status === 404, undefined);

    // 11. Health sits outside the API prefix and is proxied to the bare origin.
    const health = await fetch(`${WEB_BASE}/api/v1/health`);
    record(
      'health is proxied outside the /api/v1 prefix',
      health.ok,
      await health.text().then((t) => t.slice(0, 40)),
    );

    // 12. Page shells render with labels and no prefilled values.
    const loginPage = await fetch(`${WEB_BASE}/login`).then((r) => r.text());
    record(
      'login page ships a phone field with a label and no sample value',
      loginPage.includes('Numero ya telefone') && !loginPage.includes('value="07'),
      undefined,
    );
    const registerPage = await fetch(`${WEB_BASE}/register`).then((r) => r.text());
    record(
      'register page offers the self-service roles',
      registerPage.includes('Gutwara moto'),
      undefined,
    );
    const verifyPage = await fetch(`${WEB_BASE}/verify?purpose=LOGIN&phone=0781234567`).then((r) =>
      r.text(),
    );
    record(
      'verify page shows the number in local form',
      verifyPage.includes('078 123 456'),
      verifyPage.slice(0, 160).replace(/\s+/g, ' '),
    );
    const verifyBad = await fetch(`${WEB_BASE}/verify`).then((r) => r.text());
    record(
      'verify without a number refuses to guess one',
      verifyBad.includes('Hari ikibazo cyabaye'),
      undefined,
    );
    const accountPage = await fetch(`${WEB_BASE}/account`).then((r) => r.text());
    record(
      'account page renders the signed-out shell',
      accountPage.includes('Konti yawe'),
      undefined,
    );
    record(
      'no page leaks the access token into HTML',
      ![loginPage, registerPage, verifyPage, accountPage].some((html) =>
        html.includes(ACCESS_TOKEN),
      ),
      undefined,
    );

    // 13. API down: the proxy answers a 502 envelope rather than hanging.
    await new Promise((resolve) => stub.close(resolve));
    const down = await fetch(`${WEB_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '0781234567' }),
    });
    const downJson = await down.json().catch(() => null);
    record(
      'unreachable API becomes a labelled 502 the UI can translate',
      down.status === 502 &&
        downJson?.success === false &&
        downJson?.error?.details?.[0]?.code === 'upstream_unreachable',
      JSON.stringify(downJson?.error?.details),
    );
  } finally {
    web.kill();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log('Failed checks:');
    failed.forEach((f) => console.log(`  - ${f.name}`));
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
