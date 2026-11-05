# Deployment

Two deployables — the NestJS API and the Next.js web app — plus one PostgreSQL database. Nothing else is required for this milestone: no Redis, no queue, no object storage.

## Environment variables

The API parses its environment through a Zod contract (`apps/api/src/config/environment.ts`) and **refuses to boot** on a missing or malformed value, listing every problem at once. The web app reads three values and defaults the rest.

| Variable                  | Default                        | Notes                                                                                                                                         |
| ------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                | `development`                  | `production` or `staging` forbids `SMS_PROVIDER=log`, marks cookies `Secure`, and blocks `pnpm run db:seed`                                   |
| `DATABASE_URL`            | —                              | required; pooled URL is fine                                                                                                                  |
| `DIRECT_DATABASE_URL`     | —                              | set to the non-pooled URL when `DATABASE_URL` goes through a pooler; migrations need a session-pinned connection                              |
| `REDIS_URL`               | —                              | unused in this milestone; jobs run in-process when it is unset                                                                                |
| `JWT_ACCESS_SECRET`       | —                              | required, at least 32 characters                                                                                                              |
| `JWT_REFRESH_SECRET`      | —                              | required, at least 32 characters, **must differ** from the access secret or boot fails                                                        |
| `ACCESS_TOKEN_TTL`        | `900`                          | seconds, 60–3600                                                                                                                              |
| `REFRESH_TOKEN_TTL`       | `2592000`                      | seconds, up to 180 days                                                                                                                       |
| `OTP_TTL_SECONDS`         | `300`                          | 60–900                                                                                                                                        |
| `OTP_MAX_ATTEMPTS`        | `5`                            | 3–10                                                                                                                                          |
| `SMS_PROVIDER`            | `log`                          | `log` is a stand-in that never sends; `mtn` and `twilio` are accepted by the contract but have no adapter yet, so the first send fails loudly |
| `API_PORT`                | `4000`                         |                                                                                                                                               |
| `API_BASE_URL`            | `http://localhost:4000/api/v1` | web app: where the proxy forwards to                                                                                                          |
| `APP_WEB_URL`             | `http://localhost:3000`        | absolute URL builder and the metadata base                                                                                                    |
| `CORS_ALLOWED_ORIGINS`    | `http://localhost:3000`        | comma-separated browser origins allowed to send credentials                                                                                   |
| `WEB_UPSTREAM_TIMEOUT_MS` | `10000`                        | web app: proxy timeout before it returns `upstream_unreachable`                                                                               |
| `SEED_PHONE_PREFIX`       | `+2507880000`                  | development seed accounts only                                                                                                                |

Generate each secret rather than reusing a sample:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Leave `REDIS_URL`, `MTN_*`, `STORAGE_*`, `GOOGLE_MAPS_API_KEY`, `FCM_*` and `SENTRY_DSN` unset until their epic: the contract treats them as absent and the code paths that would use them do not exist yet.

## First release

```bash
pnpm install --frozen-lockfile          # postinstall runs prisma generate
pnpm turbo build                        # packages, then both apps
pnpm run db:check-migration             # committed SQL still matches schema.prisma
pnpm run prisma:migrate:deploy          # the only step that touches the schema
pnpm exec prisma migrate status --schema prisma/schema.prisma
```

Then start the API and the web app. **No application instance runs migrations at boot** — several replicas migrating the same schema simultaneously is a known way to break a deployment, and the specification requires migrations to come from a controlled procedure.

## Start commands

```bash
# API
NODE_ENV=production node apps/api/dist/main.js

# Web
NODE_ENV=production pnpm --filter @seremoto/web start     # next start -p 3000
```

The API listens on `0.0.0.0:${API_PORT}`, sets `trust proxy` for one hop, and applies `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store` to every response. If your platform puts more than one proxy in front of it, raise that hop count or the IP-keyed rate limits count the wrong address.

## Health checks

`GET /health` (no `/api/v1` prefix, no token) does a real database round trip and returns `{"status":"ok","database":"up"}` — or `database: "down"` with **503**. Point the platform's readiness probe at it. A configuration that reports healthy without checking is not offered, so a database outage is visible to the load balancer instead of producing 200s with empty data.

## Web proxy assumptions

The browser only talks to the web origin, and `/api/v1/*` is proxied server-side. Two consequences to keep in mind when choosing a host:

- The web app and the proxy must stay on the same origin, or `sere_refresh` stops being first-party and browsers will drop it.
- The API host must be reachable from the web server but does not need to be public. Keeping it private is the better default; if it is public, `CORS_ALLOWED_ORIGINS` is what limits which sites may send credentials to it.

## Scaling and the limits that change meaning

`ThrottleGuard` keeps its counters in one process. One instance means a real limit; several instances multiply it by the instance count and reset on restart. Configure `REDIS_URL` and a Redis-backed limiter before scaling horizontally, and say so in the runbook rather than assuming the limit holds.

The same applies to scheduled jobs, which currently run in-process.

## Hosting decisions for this project

- **Database**: a free hosted PostgreSQL — Neon or Supabase. Create a second database whose name contains `test` (for example `seremoto_test`) for the end-to-end suite; the suite refuses any other URL so it cannot clean a shared instance.
- **API and web**: any host that runs Node 20 and keeps two services on one origin pair (Render, Fly.io, Railway, a container platform, or a VPS behind nginx). The build is `pnpm turbo build`; nothing requires a proprietary runtime.
- **`.github/workflows/deploy.yml` is deliberately absent.** A deployment workflow needs a target host and credentials that do not exist yet, and committing a placeholder that cannot run would misrepresent what is finished. `ci.yml` and `api-tests.yml` are real and do run.
- **Secrets** go in the platform's secret manager. Never commit `.env` — this repository is public, and `.gitignore` excludes `.env`, `.env.*`, `*.pem` and `secrets/`.

## Rollback

1. Deploy the previous release of the API and web app.
2. If the schema changed, apply a forward migration that reverses the change; `0_init` is never edited and `prisma migrate rollback` is not used against a shared database.
3. `GET /health` must return `database: "up"` before traffic goes back.

Because access tokens live at most an hour and refresh tokens rotate on use, a rollback of the API does not invalidate sessions as long as `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are unchanged. Replacing those secrets signs every user out.

## Things to do before real customers

Real SMS delivery, consent capture (`ConsentRecord` exists with no screen using it), backups and a tested restore, monitoring and alerting, a written incident process, dependency auditing in CI, and HTTPS with HSTS at the edge. Each is listed in `docs/SECURITY.md` with the reason it matters.
