# User flows

Every screen, state and message that exists in this milestone. Labels are quoted exactly as they render, in English; the Kinyarwanda strings are the primary ones and are what a first-time visitor sees, because the default language is `rw`.

## Where a visitor starts

`GET /` — the public home page, server-rendered in the visitor's language.

- `resolveLanguage()` order: the `sere_lang` cookie, then `Accept-Language`, then `rw`.
- Header: brand, _Services_, _Log In_ (or _Account_ when the access cookie is present), and a one-tap language toggle.
- Hero: _Motorcycle services in one app_ / _Ride, deliver, shop and manage a cooperative from your phone._ and the _Get started_ call to action.
- _What SERE MOTO does_ lists the services the platform is being built around. No counts, no "trusted by" claims, no invented statistics.

The header hint that decides _Log In_ versus _Account_ reads only for the presence of the cookie. It is a navigation convenience, never an authorization decision — the API still re-checks the session and the role on every call.

## Creating an account

`GET /register` — fields start empty; there are no sample values in placeholders or hints.

| Field               | Label          | Hint                                                                                                                                   |
| ------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Full name           | _Full name_    | _As it appears on your ID_                                                                                                             |
| Phone number        | _Phone number_ | _Rwandan mobile number, 10 digits starting with 07_                                                                                    |
| Language            | _Language_     | Kinyarwanda or English                                                                                                                 |
| What you want to do | _I want to_    | _Book rides and deliveries_, _Work as a rider_, _Sell products_, _Run a repair garage_, _Manage a cooperative_, _Book for my business_ |

Submitting (`*Send code*`) calls `POST /auth/register`. The API answers with the E.164 number, `expiresInSeconds`, the `purpose` of the code it just issued, and — with `SMS_PROVIDER=log` outside production — `devOtpCode`, which the page shows as _Development mode: your code is 246813._ and hands to the verify step through `sessionStorage`, never through the URL.

The visitor is then sent to `/verify?purpose=REGISTER&phone=0781234567`.

Failure copy: an already-registered number shows _This number already has an account. Log in instead._ with a link to _I already have an account_. A name containing digits, or a number that is not a Rwandan mobile line, is caught by the same shared schema the API uses, so the client and server cannot disagree.

## Signing in

`GET /login` — _Log in_ / _Enter your phone number and we will send a code._ One phone field and one _Continue_ button.

`POST /auth/login` returns the purpose of the code it issued. This matters: a number that was registered but never confirmed gets `REGISTER`, so the verify step is told rather than left to guess — and `otp.verify` matches on `(phone, purpose)`, so a guessed `LOGIN` would reject a perfectly valid code.

## Confirming the code

`GET /verify?purpose=…&phone=…&minutes=…`

- Title _Enter the 6-digit code_, subtitle _Sent to 078 123 4567. It expires in 5 minutes._
- The phone is displayed in local form (`078 123 4567`), while the value sent to the API is E.164.
- The code input is `autocomplete="one-time-code"`, digits only, six characters maximum, and 16px so a phone does not auto-zoom.
- _Send a new code_ re-requests; _Confirm code_ posts `phone`, `code`, `purpose`.

If the query string is missing or nonsense — an unknown purpose, a number that cannot be normalised — the page refuses to guess and sends the visitor back to login or register instead of posting a made-up purpose.

Success replaces the route with `/account` and refreshes the tree, so the header and the account page both read the new session.

Errors are translated by code, never printed from the server: `INVALID_OTP` → _That code is not correct_, `OTP_EXPIRED` → _That code expired. Request a new one._, `OTP_TOO_MANY_ATTEMPTS` → _Too many attempts. Request a new code._, `RATE_LIMITED` → _Please wait a moment before trying again._

## The account page

`GET /account` shows what the API returned for this exact token:

- _Signed in as_ the name, the phone in local form, _Roles_ and _Permissions_ as they were derived from the database, and _Phone verified_.
- _Your account_ panel with the language switch and the name/email form (`account:update`). _Changing the language keeps you signed in._ is true, and the e2e suite proves the same access token still works after the change.
- _Active sessions_ (`session:manage`): each row shows _Desktop · Chrome_ style device label or _Unknown device_, the last-used and expiry times formatted for Rwanda, and _This device_ for the current one. _End session_ asks _Log out of this device?_ before posting, and the confirmation is inline, not a browser dialog.
- _Log Out_ clears both cookies.

Nothing on this screen is a placeholder. The page carries the note _Everything on this screen comes from the API for the account you signed in with._ because the profile, booking and wallet panels are not built yet — they are absent rather than faked.

## Language switching

The toggle posts to `/api/locale`, which writes `sere_lang` (readable cookie, one year) and redirects or returns JSON, then `router.refresh()` re-renders on the server. No JavaScript-based dictionary swap, no reload of the session, no lost form state beyond the in-flight transition. Both languages are complete: `pnpm --filter @seremoto/localization test` fails if a key exists in one and not the other.

## What a staff persona can see today

Only the user directory (`admin:user:read`) exists as a staff endpoint, and it is reachable through the API — there is no admin screen yet. A customer, rider, merchant or garage token is refused with _You do not have access to this._ Support, verification, finance and admin personas pass the guard; the difference between them is the permission list, which is why the permission catalog, not the role name, is what the UI and the guards consult.

## Journeys that are not built

Booking a ride, tracking a rider, paying with MTN Mobile Money, rider document upload and verification, marketplace orders, cooperative membership, notifications, and the mobile app. Each belongs to its epic. No screen in this milestone pretends to do any of them.
