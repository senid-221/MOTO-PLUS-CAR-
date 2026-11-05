# SERE MOTO Rwanda

A motorcycle mobility platform for Rwanda: ride booking, cargo delivery, shopping requests, spare parts, garage services, cooperative management and rider development — one account, one database, Kinyarwanda first.

This repository is the real platform, not a mockup. Every screen is fed by the API, and the API reads PostgreSQL. Where a piece is not built yet, it is listed as not built rather than faked.

## Current state

The first milestone is complete: monorepo foundation plus database and authentication.

| Area                                                                                       | Status                                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| pnpm workspaces + Turborepo, four shared packages, two apps                                | done                                                  |
| PostgreSQL schema (33 tables, 19 enums) and the initial migration                          | applied on PostgreSQL 16 in CI; drift gate green      |
| Phone OTP registration, login, sessions, refresh rotation, reuse detection                 | done — 105 unit tests, 12 e2e journeys green          |
| Roles and permissions for the 14 personas, enforced per request                            | done                                                  |
| Next.js web: home, register, login, verify, account; rw/en switch that never logs out      | done                                                  |
| CI: quality job, web journey job, PostgreSQL e2e job                                       | green on every push to `main`                         |
| Migration applied to **your** hosted database                                              | **awaiting the `DATABASE_URL` from Neon or Supabase** |
| Bookings, riders onboarding, payments, marketplace, cooperative, admin portals, mobile app | not started                                           |

## Layout

```
apps/api            NestJS modular monolith (REST, /api/v1)
apps/web            Next.js 15 site: public pages, customer account, auth proxy
packages/shared-types   enums, permission catalog, API contracts
packages/validation     Zod schemas, phone normalisation, decimal-safe money
packages/localization   Kinyarwanda and English copy (parity-tested)
packages/prisma-client  the one generated Prisma client every app imports
packages/config     shared tsconfig and eslint bases
prisma/             schema.prisma, migrations/, seed/
```

## Prerequisites

Node 20.11 or newer, pnpm 10 or newer, and a PostgreSQL 15+ database. Neon and Supabase both work; use the pooled connection string for `DATABASE_URL` and the direct one for `DIRECT_DATABASE_URL` when migrating.

## Setup

```bash
pnpm install                 # also runs prisma generate
cp .env.example .env         # then fill DATABASE_URL and the two JWT secrets
pnpm run prisma:migrate:deploy
pnpm run db:seed             # development accounts only; refuses production
pnpm run dev                 # api on 4000, web on 3000
```

Generate signing keys with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`SMS_PROVIDER=log` makes the OTP endpoint return the code in `devOtpCode` so the whole flow is testable without an SMS contract. It is refused when `NODE_ENV=production`, and it is the only stand-in in this milestone — nothing else is simulated.

## Commands

| Command                                      | What it checks                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run verify`                            | type check (including the e2e specs), seed type check, migration drift, lint, 154 unit tests                                    |
| `pnpm turbo build`                           | builds every package and both apps                                                                                              |
| `pnpm --filter @seremoto/web test:harness`   | boots the built site against a stand-in API and asserts the auth journey: proxying, hidden cookies, token stripping, rw/en copy |
| `pnpm turbo test:e2e --filter=@seremoto/api` | register → OTP → session → refresh rotation → RBAC denial → logout against real PostgreSQL                                      |
| `pnpm run db:check-migration`                | the committed SQL still matches `schema.prisma`                                                                                 |
| `pnpm run prisma:migrate:deploy`             | applies the committed migrations to the database in `DATABASE_URL`                                                              |
| `pnpm run prisma:migrate:status`             | reports whether every committed migration is present in that database                                                           |

The e2e suite refuses any `DATABASE_URL` whose name does not contain `test`, so a shared database cannot be cleaned by a test run.

## Reading order

1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how a request travels and why the modules are cut this way.
2. [docs/API.md](docs/API.md) — the endpoints that exist today, with real shapes.
3. [docs/DATABASE.md](docs/DATABASE.md) — schema conventions, money, migration workflow.
4. [docs/SECURITY.md](docs/SECURITY.md) — tokens, cookies, throttling, and the honest limitations.
5. [docs/USER_FLOWS.md](docs/USER_FLOWS.md) — the journeys a customer or rider takes.
6. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — environment variables and release procedure.

## Working rules for this project

- Money is never a JavaScript float: integer minor units or `Decimal`, validated at the edge.
- Phone numbers are stored as E.164 and displayed as `07X XXX XXXX`.
- Permissions come from the database on every request, never from the token.
- Privileged and financial actions write an audit row.
- No statistics, counts or records are invented in code or in seeds.
- Every user-facing string exists in both `rw` and `en`; the localization parity test fails otherwise.
- `.env` never enters this repository.
