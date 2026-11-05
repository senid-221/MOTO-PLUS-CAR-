# API reference

Base URL: `/api/v1`. `GET /health` is deliberately outside the prefix so a load balancer can probe it.

Every response uses one of two envelopes:

```json
{ "success": true, "data": { }, "message": "…" }
{ "success": false, "error": { "code": "INVALID_OTP", "message": "…", "details": [] } }
```

`error.code` is the stable, machine-readable value clients switch on; `error.message` is English for developers and logs. **Clients must not print `error.message`** — the web app maps each code to localized copy (`apps/web/lib/errors.ts`), so a customer reads Kinyarwanda, never a translated-once English string.

Error codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `ACCOUNT_NOT_ACTIVE`, `RIDER_NOT_VERIFIED`, `INVALID_OTP`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `RATE_LIMITED`, `IDEMPOTENCY_CONFLICT`, `PAYMENT_PROVIDER_ERROR`, `INTERNAL_ERROR`.

## Endpoints implemented in this milestone

### `POST /auth/register` — 201

```json
{
  "fullName": "Uwimana Eric",
  "phone": "0781234567",
  "preferredLanguage": "rw",
  "roles": ["CUSTOMER"]
}
```

`phone` is normalised to E.164 (`+250781234567`). `CUSTOMER`, `RIDER`, `MERCHANT`, `GARAGE`, `COOPERATIVE_MANAGER` and `BUSINESS_CLIENT` can be self-assigned; every staff role returns `VALIDATION_ERROR` with `Role SUPPORT must be granted by an administrator`.

```json
{
  "userId": "…",
  "phone": "+250781234567",
  "verificationRequired": true,
  "expiresInSeconds": 300,
  "purpose": "REGISTER",
  "devOtpCode": "481203"
}
```

`devOtpCode` is present only when `SMS_PROVIDER=log` and `NODE_ENV` is not `production`. The account stays `PENDING` with `phoneVerifiedAt = null` until the code is confirmed.

### `POST /auth/login` and `POST /auth/send-otp` — 201

```json
{ "phone": "0781234567" }
```

```json
{ "phone": "+250781234567", "purpose": "LOGIN", "expiresInSeconds": 300, "devOtpCode": "246813" }
```

`purpose` is what the client must echo back at verify time. A number that has never confirmed its phone gets `REGISTER` even when the visitor pressed _log in_ — guessing the purpose would reject a perfectly valid code. A number with **no account at all** returns `NOT_FOUND` (404): registration is the entry point for a new customer, and a sign-in request must never quietly create one. The trade-off is recorded in [SECURITY.md](SECURITY.md) because it does tell a caller whether a number is registered.

`POST /auth/refresh` after a logout returns 401 `TOKEN_INVALID`, not `UNAUTHENTICATED`: the presented token is recognised and already spent, which is the reuse branch, and it revokes every remaining session for that account as a precaution.

### `POST /auth/verify-otp` — 201

```json
{ "phone": "0781234567", "code": "246813", "purpose": "LOGIN" }
```

Returns a session and sets the refresh cookie (`sere_refresh`, httpOnly, `Path=/api/v1/auth`, `SameSite=Lax`, `Max-Age=REFRESH_TOKEN_TTL`, `Secure` in production):

```json
{
  "tokens": {
    "accessToken": "eyJ…",
    "accessTokenExpiresInSeconds": 900,
    "refreshTokenExpiresInSeconds": 2592000
  },
  "user": {
    "id": "…",
    "fullName": "…",
    "phone": "+250781234567",
    "email": null,
    "preferredLanguage": "rw",
    "status": "ACTIVE",
    "roles": ["CUSTOMER"],
    "permissions": ["account:read", "…"],
    "phoneVerified": true
  }
}
```

Wrong code → `INVALID_OTP` (401). Expired → `OTP_EXPIRED` (410). Fifth wrong attempt → `OTP_TOO_MANY_ATTEMPTS` (429) and the challenge is invalidated, so the real code stops working too.

### `POST /auth/refresh` — 200

Reads `sere_refresh`; no body. Returns the same session shape with a **new** access token and a **new** refresh cookie. The presented token is revoked on success, so a replayed token fails instead of silently working.

### `POST /auth/logout` — 200

Works with or without a valid access token, because an expired token must not trap someone in a session. Returns `{ "revoked": true }` and clears the refresh cookie with `Max-Age=0`.

### `GET /auth/me` — 200

The `user` object above, re-read from the database. Client code uses `permissions`, never `roles`, to decide what to show.

### `GET /auth/sessions` — 200 · `session:manage`

```json
[
  {
    "sessionId": "…",
    "deviceLabel": "Desktop · Chrome",
    "createdAt": "…",
    "lastUsedAt": "…",
    "expiresAt": "…",
    "current": true
  }
]
```

Only `ACTIVE`, unexpired sessions belonging to the caller. `deviceLabel` is derived from the user agent and is `null` when nothing was sent.

### `POST /auth/sessions/:id/revoke` — 200 · `session:manage`

Revokes one of the caller's own sessions and writes `auth.session.revoked` to the audit log. Another user's id returns `NOT_FOUND`.

### `PATCH /users/profile` — 200 · `account:update`

Any of `fullName`, `email`, `preferredLanguage`; at least one is required. `fullName` must not contain digits. Returns the updated `user`. Changing the language here never touches the session.

### `GET /admin/users` — 200 · `admin:user:read`

Staff user directory, read straight from PostgreSQL.

```
?page=1&limit=20&role=RIDER&status=ACTIVE&search=Mugisha
```

```json
{
  "items": [
    {
      "id": "…",
      "fullName": "…",
      "phone": "+250788000001",
      "preferredLanguage": "rw",
      "status": "ACTIVE",
      "roles": ["CUSTOMER", "SUPPORT"],
      "phoneVerified": true,
      "activeSessions": 1,
      "createdAt": "2026-11-05T10:00:00.000Z",
      "lastLoginAt": null
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Deleted accounts leave the directory unless `status=DELETED` is asked for explicitly. `limit` caps at 100 at the schema level. A customer, rider, merchant or garage token is refused with `FORBIDDEN` (403) — the e2e suite asserts both the refusal and the grant.

### `GET /health` — 200 (no prefix, no token)

```json
{ "status": "ok", "service": "seremoto-api", "version": "0.1.0", "database": "up", "time": "…" }
```

Performs a real round trip. `database: "down"` returns **503**; there is no configuration that reports healthy without checking.

## Rate limits

| Endpoint                                  | Limit         | Keyed by |
| ----------------------------------------- | ------------- | -------- |
| `POST /auth/register`                     | 10 per 10 min | phone    |
| `POST /auth/login`, `POST /auth/send-otp` | 5 per 5 min   | phone    |
| `POST /auth/verify-otp`                   | 15 per 5 min  | phone    |
| `POST /auth/refresh`                      | 30 per 5 min  | IP       |

State is per API process; see [SECURITY.md](SECURITY.md) for what changes when more than one instance runs.

## Not implemented yet

Booking, matching, fare quotation, wallet and ledger, MTN MoMo collection and webhook endpoints, refunds, rider onboarding and document review, marketplace orders, cooperative management, notifications, uploads, and every admin dashboard other than the user directory. Their routes are not registered, so they return `NOT_FOUND` rather than a stub success — a client cannot mistake an unbuilt feature for a working one.
