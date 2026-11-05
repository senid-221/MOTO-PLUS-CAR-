import { Test } from '@nestjs/testing';
import { AuthService } from './modules/identity/auth.service';
import { AuthController } from './modules/identity/auth.controller';
import { OtpService } from './modules/identity/otp.service';
import { TokenService } from './modules/identity/token.service';
import { JwtAuthGuard } from './common/security/guards/jwt-auth.guard';
import { PrismaService } from './common/database/prisma.service';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './common/security/decorators';
import { THROTTLE_KEY } from './common/http/throttle.guard';
import { UsersController } from './modules/users/users.controller';
import { AdminUsersController } from './modules/admin/admin-users.controller';
import { HealthController } from './modules/health/health.controller';
import { AppModule } from './app.module';

/**
 * Boot-time wiring check. Nest resolves the whole dependency graph here, so a
 * provider that was never registered, a missing module import, or an
 * environment contract that refuses to parse fails this test instead of
 * failing the first login in production. Prisma is replaced by a stub because
 * no database exists in a unit run.
 */
describe('application module graph', () => {
  const original = { ...process.env };

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/seremoto_test?schema=public';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
    process.env.SMS_PROVIDER = 'log';
  });

  afterAll(() => {
    process.env = { ...original };
  });

  it('starts with every controller, service and global guard resolvable', async () => {
    const stubPrisma = {
      $connect: jest.fn(async () => undefined),
      $disconnect: jest.fn(async () => undefined),
      $queryRaw: jest.fn(async () => [{ ok: 1 }]),
      isHealthy: jest.fn(async () => true),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(stubPrisma)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    expect(app.get(AuthController)).toBeDefined();
    expect(app.get(UsersController)).toBeDefined();
    expect(app.get(AdminUsersController)).toBeDefined();
    expect(app.get(HealthController)).toBeDefined();
    expect(app.get(AuthService)).toBeDefined();
    expect(app.get(OtpService)).toBeDefined();
    expect(app.get(TokenService)).toBeDefined();
    expect(app.get(JwtAuthGuard)).toBeDefined();

    await app.close();
  });

  it('marks every unauthenticated entry point public', () => {
    const openRoutes = ['register', 'login', 'sendOtp', 'verifyOtp', 'refresh', 'logout'] as const;
    for (const route of openRoutes) {
      const handler = AuthController.prototype[route] as unknown as () => void;
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    }
  });

  it('rate limits the endpoints an attacker would drive', () => {
    const limitedRoutes = ['register', 'login', 'sendOtp', 'verifyOtp', 'refresh'] as const;
    for (const route of limitedRoutes) {
      const handler = AuthController.prototype[route] as unknown as () => void;
      expect(Reflect.getMetadata(THROTTLE_KEY, handler)).toEqual(
        expect.objectContaining({ limit: expect.any(Number), windowSeconds: expect.any(Number) }),
      );
    }
  });

  it('keeps the session and profile routes behind explicit permissions', () => {
    const me = AuthController.prototype.me as unknown as () => void;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, me)).toBeUndefined();

    for (const route of ['sessions', 'revokeSession'] as const) {
      const handler = AuthController.prototype[route] as unknown as () => void;
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(['session:manage']);
    }

    const profile = UsersController.prototype.updateProfile as unknown as () => void;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, profile)).toBeUndefined();
    expect(Reflect.getMetadata(PERMISSIONS_KEY, profile)).toEqual(['account:update']);
  });

  it('keeps the staff directory behind an admin permission on the whole controller', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AdminUsersController)).toEqual(['admin:user:read']);
    const list = AdminUsersController.prototype.list as unknown as () => void;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, list)).toBeUndefined();
  });
});
