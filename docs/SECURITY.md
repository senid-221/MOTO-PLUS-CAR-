# Security

This file states what is protected, how, and what is **not** protected yet. It is written for the person who deploys this, not for marketing.

## What is enforced in code, not in prose

| Rule                                         | How it is enforced                                                                                                                                    | Where it is tested                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Staff roles cannot be self-assigned          | `selfAssignableRolesSchema` rejects any role outside `CUSTOMER, RIDER, MERCHANT, GARAGE, COOPERATIVE_MANAGER, BUSINESS_CLIENT` at the validation pipe | API unit tests, web register form                          |
| Permissions are never trusted from the token | The access JWT carries only `{sub, sid, typ}`; `JwtAuthGuard` re-reads roles, permissions and account status from PostgreSQL on every request         | `jwt-auth.guard.spec.ts`, e2e role-grant test              |
| A revoked session dies immediately           | The guard checks the `Session` row is `ACTIVE` and unexpired before the handler runs                                                                  | e2e logout test                                            |
| A stolen refresh token is detectable         | Every `POST /auth/refresh` revokes the presented token and issues a new one; replaying the old value fails                                            | e2e rotation and replay test                               |
| OTP codes are not stored readably            | `OtpChallenge.codeHash` is `otp$<random salt>$<sha256>`; comparison uses `timingSafeEqual`                                                            | hashing spec, e2e asserts the stored value is not the code |
| Brute force spends the challenge             | After `OTP_MAX_ATTEMPTS` wrong codes the challenge is invalidated, so even the correct code stops working                                             | e2e                                                        |
| Money is never a float                       | Amounts enter as strings, are parsed to integer minor units, and columns are `Decimal`                                                                | validation money tests                                     |
| Phones are one format                        | `phoneSchema` normalises to E.164 before anything touches the database                                                                                | validation phone tests, e2e local-form register            |
| No mock data in responses                    | Only `GET /health` reports from a real probe; the admin directory counts sessions from the database; the seed writes no operating figures             | harness, service specs                                     |

## Tokens and cookies

| Cookie         | Set by        | Attributes                                                                                                             | Why                                                                                                                                                      |
| -------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sere_refresh` | the API       | `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=REFRESH_TOKEN_TTL`, `Secure` in production-like environments | scoped so it is only sent to auth routes; first-party because the web proxy lives under `/api/v1`                                                        |
| `sere_access`  | the web proxy | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=ACCESS_TOKEN_TTL`, `Secure` when production-like                        | keeps the bearer token out of page JavaScript; the proxy re-attaches `Authorization` and deletes `data.tokens.accessToken` from every auth response body |
| `sere_lang`    | the web app   | readable, `Max-Age` one year                                                                                           | language is not a secret and must not be tied to the session; switching language cannot log anyone out                                                   |

The web app asserts, in CI, that no page HTML contains the access token and that the response body a browser receives has had the token removed.

`POST /auth/logout` clears both cookies with `Max-Age=0` and works even with an expired access token, so a user is never trapped in a session they cannot end.

## Rate limits and their real scope

`ThrottleGuard` is a fixed-window limiter keyed per phone number (register, login, verify) or per IP (refresh). **State lives in the process memory of one API instance.** With two instances the limit effectively doubles, and a restart clears the buckets. Before horizontal scaling, this must be replaced with the Redis-backed limiter (`REDIS_URL` is already an optional environment variable). This is a known limitation, not an oversight.

Related: behind a reverse proxy the API sets `trust proxy` so `req.ip` comes from `X-Forwarded-For`. If the deployment puts more than one proxy hop in front of the API, that value has to be raised to the real hop count or IP-keyed limits count the wrong address.

## The development stand-ins, stated plainly

1. **`SMS_PROVIDER=log` returns the OTP code in the API response** as `devOtpCode`, and the web app carries it from the register/verify step through `sessionStorage` so the flow is testable without an SMS contract. The environment contract refuses `SMS_PROVIDER=log` when `NODE_ENV=production` or `staging`, and `exposesDevOtp()` is what any response goes through — so a production deployment cannot accidentally hand out other people's codes. Anyone with network access to a _non-production_ API can therefore log in as any phone number. Treat staging as if it were production: put it behind authentication, or configure a real provider.
2. **The seed creates predictable accounts.** `pnpm run db:seed` writes ACTIVE, phone-verified accounts at `SEED_PHONE_PREFIX` + two digits (default `+250788000001`…), including one with the `ADMIN` role. It refuses to run when `NODE_ENV` is `production` or `staging`. If a seeded database is ever promoted, those accounts must be removed or demoted first — the `ADMIN` one especially.
3. **The e2e suite refuses any `DATABASE_URL` whose name does not contain `test`.** It deletes the accounts and OTP challenges it created, keyed on a per-run random phone tag, so it cannot clean a shared database by accident.
4. **No OTP has ever been sent to a real person from this codebase.** The only SMS adapter is `LogSmsProvider`; it writes a `[DEV ONLY] SMS to … was not sent` warning and returns a reference. Setting `SMS_PROVIDER=mtn` or `twilio` makes the first send fail loudly (the error is logged and rethrown, so the caller sees `INTERNAL_ERROR`) instead of silently dropping the message someone is waiting for. The `MTN_*` variables in `.env.example` are placeholders for that adapter and are not part of the environment contract yet.

## Not protected yet

Honest gaps to close before real customers or money move through this system.

- **No password or PIN authentication.** The `passwordHash` column exists and is unused; nothing writes it. OTP-only login means the security of an account is the security of the SIM. Number-porting and SIM-swap fraud are therefore in scope for the threat model, and step-up confirmation on sensitive actions is a planned control, not a present one.
- **Reads are not audited.** `AuditLog` rows are written for privileged state changes (session revocation, role state, profile changes). Reads of the staff directory — which exposes every user's phone number — are not logged. Add access logging before giving this to support staff at scale.
- **No key rotation.** Access tokens are HS256 with a single `JWT_ACCESS_SECRET`; there is no `kid`, no rotation endpoint and no dual-secret window. Rotating the secret invalidates every session. Move to asymmetric keys or a rotation procedure before scaling.
- **Cookie CSRF surface.** Auth requests are same-site POSTs with `SameSite=Lax`, and the refresh endpoint reads only the cookie, so a cross-site form post can trigger a refresh. Add a CSRF token or require a custom header on state-changing auth routes.
- **No rate limit on the web proxy itself**, and the per-IP key depends on the proxy chain being correct.
- **No secrets management.** `.env` is gitignored and must never be committed — this repository is public. Production values belong in the host's secret manager, not in a repository variable.
- **No dependency scanning, no WAF, no backup/restore runbook, no incident response process.** GitHub Actions runs the test suites; it does not run `pnpm audit` or a SAST scanner yet.
- **PII handling.** `ConsentRecord` exists but no screen captures consent, and there is no retention or deletion job. Rwanda's data protection law requires both before launch.

## Reporting

This is an early-stage private repository. If you find something exploitable, open a GitHub issue only if it is already public knowledge; otherwise contact the repository owner directly.
