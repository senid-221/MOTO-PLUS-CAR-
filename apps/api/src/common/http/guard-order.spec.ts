import { type CanActivate, Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';

const ran: string[] = [];

class FirstGuard implements CanActivate {
  canActivate(): boolean {
    ran.push('first');
    return true;
  }
}

class SecondGuard implements CanActivate {
  canActivate(): boolean {
    ran.push('second');
    return true;
  }
}

@Controller('probe')
class ProbeController {
  @Get()
  value(): string {
    return 'reachable';
  }
}

@Module({
  controllers: [ProbeController],
  providers: [
    { provide: APP_GUARD, useClass: FirstGuard },
    { provide: APP_GUARD, useClass: SecondGuard },
  ],
})
class ProbeModule {}

/**
 * The identity module registers the authentication guard and the rate limiter
 * under the same APP_GUARD token. If Nest kept only one registration, the other
 * protection would silently fall open, so the behaviour is pinned here rather
 * than trusted.
 */
describe('multiple APP_GUARD registrations', () => {
  beforeEach(() => {
    ran.length = 0;
  });

  it('runs every guard registered under the same token, in order', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer()).get('/probe');
    expect(response.status).toBe(200);
    expect(ran).toEqual(['first', 'second']);

    await app.close();
  });
});
