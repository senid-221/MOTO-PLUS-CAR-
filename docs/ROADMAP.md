# Roadmap — specification-to-repository audit

Produced by walking the master specification's required pre-implementation workflow (§16) against the
code that actually exists: `prisma/schema.prisma`, the module tree under `apps/api/src/modules`, the
permission catalog in `packages/shared-types/src/permissions.ts`, the route tree in `apps/web/app`, and
the endpoint reference in [API.md](API.md). Nothing in the tables below is a plan of what a module _will_
contain; each row states what was found when the file was read.

## 1. What works today, and how it is proven

The foundation and the identity layer are complete, deployed and measured — not asserted.

| Layer         | What is live                                                                                                                                | Evidence                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Repository    | pnpm workspaces + Turborepo, two apps, four shared packages, strict lint (`--max-warnings=0`), Prettier gate                                | `pnpm run verify` exits 0                                                                                                         |
| Database      | 33 models, 19 enums, the `0_init` migration applied to PostgreSQL 16 in CI and to `seremoto_dev` + `seremoto_test` on Neon                  | `prisma/schema.prisma`, migration drift gate in CI                                                                                |
| Auth          | register, OTP send/verify, login, refresh rotation with reuse detection, logout, session list and revoke, profile patch, language switch    | 105 API unit tests in 11 suites, 11 e2e journeys against a real PostgreSQL instance                                               |
| Authorization | 14 personas, a permission catalog, per-request role + permission + account-status reads from PostgreSQL                                     | `permissions.test.ts`, the RBAC branches of the e2e suite                                                                         |
| Money/date    | decimal-safe money helpers, E.164 phone normalisation, Rwanda timezone and RWF formatting shared by both languages                          | 27 validation tests                                                                                                               |
| Copy          | every user-facing string in `@seremoto/localization`, Kinyarwanda first                                                                     | 8 parity tests that fail the build when a key exists in one language only                                                         |
| Web           | landing page, marketplace/news/safety/about/contact pages, register → verify → account journey with a step indicator, same-origin API proxy | `design-conformance` gate (tokens, cascade, WCAG contrast, fonts and assets over HTTP), `nav-session-probe` (real OTP round trip) |
| Delivery      | CI quality job, web journey job, PostgreSQL e2e job                                                                                         | green on every push to `main`                                                                                                     |

## 2. Coverage against the specification

"Schema" is whether the tables exist, "API" is whether a route and service exist, "UI" is whether a
screen exists. A schema with no API deliberately returns `NOT_FOUND` rather than a stub success, which is
why the second column can be `present` while the third says `none`.

| Spec                      | Schema  | API                     | UI               | Verdict                            |
| ------------------------- | ------- | ----------------------- | ---------------- | ---------------------------------- |
| §2.1 Customer             | present | `PATCH /users/profile`  | account screen   | partial: no bookings, saved places |
| §2.2A Rider verification  | present | none                    | none             | not started                        |
| §2.2B Availability        | partial | none                    | none             | enum too narrow (§4)               |
| §2.2C Ride lifecycle      | present | none                    | none             | not started                        |
| §2.2D Delivery            | present | none                    | none             | pickup PIN missing (§4)            |
| §2.2E Rider finances      | present | none                    | none             | no settlement rows (§4)            |
| §2.2F Public profile      | present | none                    | none             | not started                        |
| §2.2G Motorcycle records  | partial | none                    | none             | fields missing (§4)                |
| §2.2H Learning centre     | absent  | none                    | static page only | not started                        |
| §3 Work categories        | absent  | none                    | none             | not started                        |
| §4 Cooperative system     | partial | none                    | none             | not started                        |
| §5 Marketplace            | partial | none                    | static page only | not started                        |
| §6 Road-law academy       | absent  | none                    | static page only | blocked on sources (§6)            |
| §7 Garage services        | absent  | none                    | none             | not started                        |
| §8 Insurance documents    | absent  | none                    | none             | not started                        |
| §9 Business portal        | partial | none                    | none             | not started                        |
| §10 Administration        | partial | user directory only     | none             | partial                            |
| §11 Notifications         | present | none                    | none             | not started                        |
| §12 Location and matching | present | none                    | none             | not started                        |
| §13 Revenue and ledger    | present | none                    | none             | not started                        |
| §14 Architecture          | —       | modular monolith        | Next.js 15       | done, mobile deferred              |
| §15 Security and privacy  | present | guards, throttle, audit | none             | partial: see §4 and §8             |

The two landing, marketplace, news, safety, about and contact pages describe services honestly and link
to the places that exist; they do not present unbuilt functionality as available.

## 3. Missing modules

Read as a NestJS module list, the domain is absent everywhere except identity:

```
exists    config · common/database · common/http · common/security · identity · users · admin · health
missing   rider · fleet · dispatch · booking · delivery · pricing · wallet · ledger · settlement
          payment (MTN MoMo collection + webhook) · marketplace · order · dispute · cooperative
          notification · garage · insurance · education · legal-content · organization · support
          upload (private object storage) · moderation · reporting
```

## 4. Schema changes required before the first domain milestone

These are the deltas the current tables cannot express. They need a controlled migration (§29) applied
through the deployment scripts, never ad hoc, and each one lands with the enum value list, a backfill
plan for the seeded rows, and the CI drift gate as its reviewer.

**Enum widening.** `VerificationStatus` has `DRAFT · SUBMITTED · UNDER_REVIEW · APPROVED · REJECTED ·
EXPIRED`, but §2.2A also requires _Additional Information Required_ and _Suspended_. `RiderStatus` has
`OFFLINE · ONLINE · BUSY · SUSPENDED`, but §2.2B also requires _On a Trip_, _On Delivery_ and _Temporarily
Unavailable_. `DocumentType` has no rider-authorisation-to-ride type or inspection certificate.
`OrderStatus` has no `DISPUTED`, which §5.4 lists. `Notification.channel` is a free string with no enum.

**Fields to add.** `Motorcycle` needs engine capacity, ownership status, registration and insurance
expiry dates, inspection data, a verification status and an operational status (§2.2G). `RiderProfile`
needs an operating-area reference and a self-declared-versus-verified distinction for experience (§2.2F).
`Booking` needs a pickup PIN hash (§2.2C.10) and, for errands, a shopping list, an approved budget, a
receipt reference and a recorded purchase cost (§2.2D and §3.3).

**Tables to create.** `RiderServiceCategory` (§3), `SavedLocation` (§2.1.5), `Settlement` and a
commission record that references `WalletEntry` (§2.2E, §13), `Dispute` (§5.4), `GarageProvider` and
`ServiceAppointment` (§7), `InsuranceProvider` and `InsurancePolicy` (§8), `Organization`,
`OrganizationBranch` and `OrganizationMember` with budgets (§9), `CooperativeMeeting`, `MeetingMinute`,
`Contribution` and a cooperative ledger (§4.4–4.5), `ProductCategory` as an entity rather than a string
column (§5.2), and the whole education set: `Course`, `Lesson`, `Quiz`, `Question`, `AnswerRecord`,
`ExamAttempt`, `Certificate`, `TrafficSign`, `LegalSource`, `LegalProvision` (§6).

Cooperative officer roles stay as `CooperativeMembership.role` strings rather than platform `UserRole`
values. That was the right first call and should be kept: one person can hold a cooperative office in
several cooperatives, and the platform role catalog should not grow a row per office.

## 5. Milestone plan

Each milestone is a vertical slice: schema, endpoints, permissions, UI in both languages, automated tests,
a real workflow run against the hosted database, and documentation of what is still missing — the eight
items §16 requires per phase, judged against the ten acceptance criteria in §17.

| Milestone | Spec phase | Scope                                                                                                                      | External dependency                      |
| --------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| EPIC 03   | 2          | Rider self-service: profile, motorcycle registration, document upload, submit for review; verification-officer queue       | private object storage                   |
| EPIC 04   | 2          | Rider availability states, suspension, cooperative membership join/approve                                                 | none                                     |
| EPIC 05   | 3          | Booking request, fare quotation from `PricingRule`, configurable rider matching, status events, service-area guard         | mapping provider for geocoding/routes    |
| EPIC 06   | 4          | Parcel delivery with proof of delivery, shopping and errands with receipts and budget approval, monthly contracts          | none                                     |
| EPIC 07   | 5          | MTN MoMo collection and webhook verification, idempotent payments, wallet ledger, commissions, settlement, refunds         | MoMo API credentials + merchant contract |
| EPIC 08   | 6          | Cooperative management: registration, members, contributions, meetings, minutes, announcements, financial statements       | none                                     |
| EPIC 09   | 7          | Marketplace: categories, listings, moderation, cart, order workflow, disputes, seller reports                              | none                                     |
| EPIC 10   | 8          | Road-safety academy: content sources, lessons, sign library, quizzes, scoring, certificates — **only after §6 below**      | verified legal sources, sign artwork     |
| EPIC 11   | 9          | Garage directory and appointments, insurance records and renewal reminders, business portal with contracts and budgets     | insurance partner agreements             |
| EPIC 12   | 10         | Admin dashboards, reporting, notification fan-out with preferences, background jobs, security hardening, production launch | Sentry, FCM, SMS provider, monitoring    |

Mobile (React Native/Expo) keeps its own milestone after EPIC 05, once booking and matching exist as APIs
that a device can consume; the shared contracts, validation schemas and copy are already in place for it.

## 6. Where the specification and reality disagree

Three points are worth settling before code, because each one changes what gets built.

**Road-law content cannot be generated.** §6 requires every lesson, fine, penalty and licence category to
carry an authoritative source and a verification date, and explicitly forbids inventing them. There is no
verified Rwanda legal corpus in this repository today, so EPIC 10 is blocked on gathering primary sources
and on a named person being accountable for legal-content review. Any earlier "Safety Academy" screen must
keep saying what it is: general safety guidance, not official licensing information. The page that ships
does exactly that and names Rwanda National Police and RTDA as the authorities.

**Money held for others is a regulated activity.** §4.4 and §13 say the platform must not present itself as
a bank or hold deposits without authorisation. That constrains EPIC 07 and EPIC 08: a wallet that only
records what a payment provider actually holds is fine; a savings or lending product is not, until it has
regulatory review.

**Verification against government databases needs an agreement.** §2.2A allows an authorised manual workflow
instead, so EPIC 03 ships manual review with a full audit trail, and any later automated check is an
integration with its own contract, not a feature flag.

## 7. External credentials and approvals to obtain

| Need                                            | Used by        | Status now                                                                                                                                   |
| ----------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| MTN Mobile Money API access                     | EPIC 07        | not requested; needs a merchant agreement                                                                                                    |
| Private S3-compatible storage                   | EPIC 03, 09    | not provisioned; document uploads are blocked without it                                                                                     |
| Mapping provider key                            | EPIC 05        | not requested                                                                                                                                |
| SMS sender (beyond `log`)                       | production OTP | not requested; `SMS_PROVIDER=log` is development-only                                                                                        |
| Firebase Cloud Messaging                        | EPIC 12        | not requested                                                                                                                                |
| Sentry project DSN                              | EPIC 12        | not configured; errors stay in server logs                                                                                                   |
| Hosted PostgreSQL                               | everything     | done — Neon project, dev and test databases                                                                                                  |
| Email provider                                  | notifications  | not requested; no support address exists yet, and the contact page says so                                                                   |
| Transport, insurance and data-protection review | §6, §13, §15   | not started; needs the competent Rwandan authority per activity, and no compliance claim may be published before documentary evidence exists |

## 8. Known limitations carried forward

`GET /health` reports `database: "down"` as 503, but a request that reaches Prisma while the compute is
asleep still surfaces as a bare `INTERNAL_ERROR` rather than a labelled `503`; users see a dead screen
instead of "try again". Rate-limit state lives in one process's memory. The web app has no component test
harness — layout is verified through geometry and computed-style gates, not screenshots. The repository
still lacks a `LICENSE` file and branch protection, and the master specification itself is not stored in
it, so this audit is the only in-repo traceability back to the requirements. Privacy consent is the
clearest unfinished item in §15: the `ConsentRecord` table exists and no line of application code reads or
writes it — grep for `consent` across `apps/api/src` returns nothing — so nobody has consented to
anything on record yet. Credentials must never be committed here; the working
`Desktop/SERE-MOTO-database.env` currently holds a live password in plain text outside the repository and
should be rotated once storage and hosting credentials move into a managed secret store.

## 9. Definition of done for every milestone

Borrowed from §17 and applied literally, because a screen is not a feature:

1. A working endpoint, not a client-side simulation.
2. Data persisted in PostgreSQL and read back in a later request.
3. The permission that guards the route, asserted both when granted and when refused.
4. Input validated by the same schema on both sides of the proxy.
5. Loading, empty and error states rendered in Kinyarwanda and English.
6. Privileged actions written to `AuditLog`.
7. Automated tests covering the domain rule, plus an e2e journey.
8. A real workflow executed against the hosted database and reported with its output.
9. Documentation updated: the endpoint reference, the module table, and this file.
10. Remaining gaps, external services still required, and known limitations stated in the milestone report.
