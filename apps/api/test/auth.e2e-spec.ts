import { randomInt } from 'node:crypto';
import { type INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Response } from 'supertest';
import { AccountStatus, PrismaClient, UserRole } from '@seremoto/prisma-client';
import { AppModule } from '../src/app.module';
import { API_ROUTE_PREFIX, UNPREFIXED_HEALTH_PATH } from '../src/common/http/route-prefix';
import { REFRESH_COOKIE_NAME } from '../src/common/http/cookies';
import type {
  ApiErrorBody,
  ApiSuccessBody,
  AuthSession,
  CurrentUserSummary,
  RegisterOutput,
  SendOtpOutput,
} from '@seremoto/shared-types';

/**
 * End-to-end authentication journey against a real PostgreSQL database.
 *
 * This suite is the acceptance check for EPIC 02: a person registers with a
 * phone number, proves they own it with the code the log SMS stand-in reports,
 * gets a session, is refused anything their roles do not permit, and can be
 * signed out. It asserts the HTTP contract the web and mobile clients actually
 * consume — envelope shape, cookie attributes, token rotation — because a
 * service-level test cannot catch a wiring mistake.
 *
 * Needs DATABASE_URL plus both JWT secrets. The connection string must contain
 * "test": a shared or production database cannot be wiped by `pnpm test:e2e`.
 */

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;

function resolveTestDatabaseUrl(): string {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      throw new Error(`${key} is required to run the authentication end-to-end suite.`);
    }
  }
  const url = process.env.DATABASE_URL as string;
  if (!/test/i.test(url)) {
    throw new Error(
      'Refusing to run the end-to-end suite against a database whose connection string does not contain "test". Point DATABASE_URL at a throwaway test database.',
    );
  }
  return url;
}

/** Unique per run so two jobs sharing one database cannot collide or clean up each other. */
const RUN_TAG = randomInt(100000, 999999).toString();

let nextSlot = 0;

/** Rwandan mobile national numbers are 7 plus eight digits; the tag keeps them unique. */
function phoneFor(slot: number): string {
  return `+2507${RUN_TAG}${String(slot).padStart(2, '0')}`;
}

/** Hands out each phone number once, so no test registers a number another test used. */
function newPhone(): string {
  const phone = phoneFor(nextSlot);
  nextSlot += 1;
  return phone;
}

const RUN_PHONES = Array.from({ length: 24 }, (_, index) => phoneFor(index));

function data<T>(response: Response): T {
  return (response.body as ApiSuccessBody<T>).data;
}

function errorOf(response: Response): ApiErrorBody['error'] {
  return (response.body as ApiErrorBody).error;
}

function cookieFrom(response: Response, name: string): string | null {
  const lines = response.headers['set-cookie'] as unknown as string[] | undefined;
  if (!lines) return null;
  for (const line of lines) {
    if (!line.startsWith(`${name}=`)) continue;
    return decodeURIComponent(line.slice(name.length + 1).split(';')[0] ?? '');
  }
  return null;
}

describe('authentication end to end', () => {
  let app: INestApplication;
  const prisma = new PrismaClient({ datasourceUrl: resolveTestDatabaseUrl() });

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_ROUTE_PREFIX, {
      exclude: [{ path: UNPREFIXED_HEALTH_PATH, method: RequestMethod.ALL }],
    });
    await app.init();
  });

  afterAll(async () => {
    await prisma.otpChallenge.deleteMany({ where: { phone: { in: RUN_PHONES } } });
    // Sessions, consents and profiles cascade from the user row.
    await prisma.user.deleteMany({ where: { phone: { in: RUN_PHONES } } });
    await app?.close();
    await prisma.$disconnect();
  });

  /** Registers a fresh number and completes the OTP step, returning the session. */
  async function signIn(
    fullName: string,
    roles: string[] = ['CUSTOMER'],
  ): Promise<{ phone: string; accessToken: string; refresh: string; session: AuthSession }> {
    const phone = newPhone();
    const registered = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/register`)
      .send({ fullName, phone, preferredLanguage: 'rw', roles })
      .expect(201);
    const register = data<RegisterOutput>(registered);

    const verified = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/verify-otp`)
      .send({ phone, code: register.devOtpCode, purpose: register.purpose })
      .expect(201);

    return {
      phone,
      accessToken: data<AuthSession>(verified).tokens.accessToken,
      refresh: cookieFrom(verified, REFRESH_COOKIE_NAME) ?? '',
      session: data<AuthSession>(verified),
    };
  }

  it('registers a phone number and reports the code without storing it in the clear', async () => {
    const phone = newPhone();
    const localForm = `0${phone.slice(4)}`;

    const response = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/register`)
      .send({ fullName: 'Uwimana Eric', phone: localForm, preferredLanguage: 'rw' })
      .expect(201);

    const body = data<RegisterOutput>(response);
    expect(body).toMatchObject({
      phone,
      verificationRequired: true,
      purpose: 'REGISTER',
      expiresInSeconds: expect.any(Number),
    });
    expect(body.devOtpCode).toMatch(/^\d{6}$/);

    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone, purpose: 'REGISTER' },
      orderBy: { createdAt: 'desc' },
    });
    expect(challenge).not.toBeNull();
    expect(challenge?.codeHash).not.toContain(body.devOtpCode ?? 'impossible');
    expect(challenge?.codeHash.startsWith('otp$')).toBe(true);

    const account = await prisma.user.findUnique({ where: { id: body.userId } });
    expect(account?.status).toBe(AccountStatus.PENDING);
    expect(account?.phoneVerifiedAt).toBeNull();
    expect(account?.passwordHash).toBeNull();
    expect(account?.roles).toEqual(['CUSTOMER']);
  });

  it('refuses a code that was never issued to that number', async () => {
    const response = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/verify-otp`)
      .send({ phone: newPhone(), code: '123456', purpose: 'REGISTER' });

    expect(response.status).toBe(401);
    expect(errorOf(response).code).toBe('INVALID_OTP');
  });

  it('rejects a wrong code and counts the attempt against the challenge', async () => {
    const phone = newPhone();
    await api()
      .post(`/${API_ROUTE_PREFIX}/auth/register`)
      .send({ fullName: 'Mukamana Alice', phone })
      .expect(201);

    const wrong = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/verify-otp`)
      .send({ phone, code: '000000', purpose: 'REGISTER' });

    expect(wrong.status).toBe(401);
    expect(errorOf(wrong).code).toBe('INVALID_OTP');

    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone, purpose: 'REGISTER' },
      orderBy: { createdAt: 'desc' },
    });
    expect(challenge?.attempts).toBe(1);
    expect(challenge?.consumedAt).toBeNull();
  });

  it('spends the challenge when an attacker keeps guessing', async () => {
    const phone = newPhone();
    await api()
      .post(`/${API_ROUTE_PREFIX}/auth/register`)
      .send({ fullName: 'Nshimiyimana Jean', phone, roles: ['RIDER'] })
      .expect(201);

    let last: Response | undefined;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      last = await api()
        .post(`/${API_ROUTE_PREFIX}/auth/verify-otp`)
        .send({ phone, code: '111111', purpose: 'REGISTER' });
    }

    expect(last?.status).toBeGreaterThanOrEqual(401);
    const codes = ['INVALID_OTP', 'OTP_TOO_MANY_ATTEMPTS'] as string[];
    expect(codes).toContain(errorOf(last as Response).code);

    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone, purpose: 'REGISTER' },
      orderBy: { createdAt: 'desc' },
    });
    expect(challenge?.consumedAt).toBeNull();
    expect(challenge?.attempts).toBeGreaterThanOrEqual(5);
  });

  it('completes the journey: code, session, /auth/me and a single-use refresh', async () => {
    const { accessToken, refresh, session, phone } = await signIn('Habimana Peter');

    expect(session.user).toMatchObject({ phone, fullName: 'Habimana Peter' });
    expect(session.user.roles).toContain('CUSTOMER');
    expect(session.user.permissions).toContain('customer:booking:create');
    expect(session.tokens.accessTokenExpiresInSeconds).toBeGreaterThan(0);

    const me = await api()
      .get(`/${API_ROUTE_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(data<CurrentUserSummary>(me).phone).toBe(phone);

    const refreshed = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/refresh`)
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refresh}`)
      .expect(200);

    const rotated = cookieFrom(refreshed, REFRESH_COOKIE_NAME);
    expect(rotated).not.toBeNull();
    expect(rotated).not.toBe(refresh);
    expect(data<AuthSession>(refreshed).tokens.accessToken).not.toBe(accessToken);

    // The presented token is single-use, so replaying it is treated as theft.
    const replay = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/refresh`)
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refresh}`);
    expect(replay.status).toBeGreaterThanOrEqual(400);
    expect(replay.status).toBeLessThan(500);
  });

  it('keeps the session alive while the customer changes language and name', async () => {
    const { accessToken, phone } = await signIn('Uwase Denise');

    const patched = await api()
      .patch(`/${API_ROUTE_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ preferredLanguage: 'en', fullName: 'Uwase Denise M' })
      .expect(200);

    expect(data<CurrentUserSummary>(patched)).toMatchObject({
      preferredLanguage: 'en',
      fullName: 'Uwase Denise M',
      phone,
    });

    // Same token after the change: switching language must never sign anyone out.
    const me = await api()
      .get(`/${API_ROUTE_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(data<CurrentUserSummary>(me).preferredLanguage).toBe('en');
  });

  it('refuses a privileged read to a signed-in customer and serves it to staff', async () => {
    const customer = await signIn('Directory Probe');

    const denied = await api()
      .get(`/${API_ROUTE_PREFIX}/admin/users`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(denied.status).toBe(403);
    expect(errorOf(denied).code).toBe('FORBIDDEN');

    // Grant the support persona the way an administrator would, then reuse the
    // token that was just refused: permissions are read from the database on
    // every request, so a role change takes effect without a new login.
    await prisma.user.update({
      where: { phone: customer.phone },
      data: { roles: [UserRole.CUSTOMER, UserRole.SUPPORT] },
    });

    const allowed = await api()
      .get(`/${API_ROUTE_PREFIX}/admin/users`)
      .query({ search: 'Directory Probe', limit: 50 })
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .expect(200);

    const list = data<{ items: { phone: string; roles: string[] }[]; meta: { total: number } }>(
      allowed,
    );
    expect(list.meta.total).toBe(1);
    expect(list.items[0]).toMatchObject({ phone: customer.phone });
    expect(list.items[0]?.roles).toContain('SUPPORT');
  });

  it('reports REGISTER for a number that cannot sign in yet and LOGIN for one that can', async () => {
    const unverified = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/login`)
      .send({ phone: newPhone() })
      .expect(201);
    expect(data<SendOtpOutput>(unverified).purpose).toBe('REGISTER');

    const { phone } = await signIn('Mutara Olivier');
    const verified = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/login`)
      .send({ phone })
      .expect(201);
    expect(data<SendOtpOutput>(verified).purpose).toBe('LOGIN');
    expect(data<SendOtpOutput>(verified).phone).toBe(phone);
  });

  it('ends the session on logout and refuses a later refresh', async () => {
    const { accessToken, refresh } = await signIn('Kamanzi Eric');

    const loggedOut = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/logout`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refresh}`)
      .expect(200);
    expect(data<{ revoked: boolean }>(loggedOut).revoked).toBe(true);

    const afterLogout = await api()
      .post(`/${API_ROUTE_PREFIX}/auth/refresh`)
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refresh}`);
    expect(afterLogout.status).toBe(401);
    expect(errorOf(afterLogout).code).toBe('UNAUTHENTICATED');

    const meAfter = await api()
      .get(`/${API_ROUTE_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meAfter.status).toBe(403);
    expect(errorOf(meAfter).code).toBe('ACCOUNT_NOT_ACTIVE');
  });

  it('rate limits repeated sign-in requests for one phone number', async () => {
    const phone = newPhone();
    let limited: Response | undefined;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await api().post(`/${API_ROUTE_PREFIX}/auth/login`).send({ phone });
      if (response.status === 429) limited = response;
    }

    expect(limited).toBeDefined();
    expect(errorOf(limited as Response).code).toBe('RATE_LIMITED');
  });

  it('answers the signed-out probe and the health check without a token', async () => {
    const unauthorized = await api().get(`/${API_ROUTE_PREFIX}/auth/me`);
    expect(unauthorized.status).toBe(401);
    expect(errorOf(unauthorized).code).toBe('UNAUTHENTICATED');
    expect(errorOf(unauthorized).details).toEqual([]);

    const health = await api().get(`/${UNPREFIXED_HEALTH_PATH}`).expect(200);
    expect(data<{ database: string }>(health).database).toBe('up');
  });
});
