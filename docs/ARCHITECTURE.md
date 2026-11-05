# Architecture

## Shape

One API, one database, one web application, and (later) one mobile app. The API is a **modular monolith**: each domain is a NestJS module inside a single deployable, and modules call each other through services and domain events instead of reaching into each other's tables. Nothing is split into a separate service until a measured reason exists — a phone-number-first platform with one Postgres database does not need distributed transactions, and premature microservices would only move the hard problems into the network.

```
browser / phone
      │  same origin only
      ▼
apps/web (Next.js 15, React 19, App Router)
      │  server-side proxy at /api/v1/[...path]
      ▼
apps/api (NestJS 10, CommonJS build)
      │  Prisma 6
      ▼
PostgreSQL (hosted: Neon or Supabase)
```

Mobile (React Native/Expo) is deferred to its own milestone. Everything it needs to drop in is already shared: `packages/shared-types` for contracts, `packages/validation` for the same Zod schemas the API enforces, and `packages/localization` for the same copy.

## Why the web app proxies the API

The browser only ever talks to the web origin. The API host stays server-side for three concrete reasons:

1. The refresh cookie stays **first-party**. It is set by the API with `Path=/api/v1/auth`, and because the proxy is mounted under `/api/v1`, the browser treats it as the same site it is already on — no cross-origin cookie, no `SameSite=None`, which third-party cookie blocking would drop anyway.
2. The access token is moved out of page JavaScript. When an auth response contains `data.tokens.accessToken`, the proxy removes that field from the JSON body and re-issues it as an `httpOnly` `sere_access` cookie. Client code never sees the token; the proxy re-attaches `Authorization: Bearer` on the way out.
3. Language and session state are separated. `sere_lang` is a readable cookie, session cookies are httpOnly, so switching between Kinyarwanda and English cannot log anybody out.

The proxy forwards every upstream `Set-Cookie` line individually (`getSetCookie()`, not the joined header), strips hop-by-hop headers, sets `cache-control: no-store`, and returns a labelled `502` envelope with code `upstream_unreachable` when the API cannot be reached, so the UI can translate that instead of showing a raw failure.

## Language choice: Kinyarwanda first

`resolveLanguage()` reads the `sere_lang` cookie, then `Accept-Language`, then defaults to `rw`. Every page renders in that language, `<html lang>` follows it, and `generateMetadata` publishes `alternates.languages` for both. No user-facing string is hard-coded in a component: all copy comes from `@seremoto/localization`, and a parity test fails the build if a key exists in one language and not the other.

## The API in one request

1. `ThrottleGuard` (global, registered after the auth guard so authentication runs first) applies a fixed-window limit to the endpoints an attacker would drive — per phone number for register/login/verify, per IP for refresh.
2. `JwtAuthGuard` (global) verifies the HS256 access token, which carries only `{sub, sid, typ}`, then reads **roles, permissions and account status from PostgreSQL** and checks the session row is still `ACTIVE` and unexpired. A suspension or a revoked role therefore takes effect on the next request, not at token expiry.
3. Route metadata (`@Public`, `@RequirePermissions`, `@RequireRoles`) decides access. `@RequirePermissions` demands every listed permission; the guard throws `FORBIDDEN` otherwise.
4. `ZodValidationPipe` parses the body, query or params with the same schema the client used. Unknown fields are stripped, never passed through.
5. The service does its work in a transaction where a failure would leave money or state half-applied, and writes an `AuditLog` row for privileged actions.
6. `ApiResponseInterceptor` wraps success as `{success: true, data, message}`; `ApiExceptionFilter` wraps failure as `{success: false, error: {code, message, details}}`. Anything that is not a domain error is reported as `INTERNAL_ERROR` with the real cause logged server-side, so internals never reach the client.

## Token model

| Token   | Form                         | Where it lives                                                                                      | Lifetime                          | Rotation                                     |
| ------- | ---------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------- |
| Access  | HS256 JWT, `{sub, sid, typ}` | `sere_access` httpOnly cookie at the web layer; bearer at the API                                   | `ACCESS_TOKEN_TTL`, default 900 s | replaced silently on expiry                  |
| Refresh | opaque 256-bit random        | SHA-256 hash in `Session.refreshTokenHash`, value in `sere_refresh` (httpOnly, `Path=/api/v1/auth`) | `REFRESH_TOKEN_TTL`, default 30 d | every use: old row revoked, new token issued |
| OTP     | 6 digits from `randomInt`    | salted SHA-256 in `OtpChallenge.codeHash`                                                           | `OTP_TTL_SECONDS`, default 300 s  | single use, spent after 5 wrong attempts     |

Replaying a rotated refresh token does not produce a session; the reuse path is what makes a stolen token detectable rather than silently valid.

## Modules

| Module            | Owns                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| `config`          | the environment contract; the API refuses to boot on a bad value        |
| `common/database` | the global `PrismaModule` and health-checked client                     |
| `common/http`     | envelope, error classes, throttling, cookie serialisation, route prefix |
| `common/security` | hashing, audit writes, guards and decorators                            |
| `identity`        | registration, OTP, sessions, tokens, login/profile read models          |
| `users`           | self-service profile changes (`account:update`)                         |
| `admin`           | staff-only reads, currently the user directory (`admin:user:read`)      |
| `health`          | liveness plus a real database round trip                                |

## Deferred by design

Payments and wallet ledger, booking matching, rider onboarding documents, marketplace, cooperative tooling, admin dashboards beyond the user directory, background jobs, Redis-backed rate limiting and push notifications. `REDIS_URL` is optional in development; when it is unset the API runs any job in-process and logs a warning rather than pretending a queue exists.
