import 'reflect-metadata';
import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { API_ROUTE_PREFIX, UNPREFIXED_HEALTH_PATH } from './common/http/route-prefix';
import { API_VERSION, SERVICE_NAME } from './version';
import type { Environment } from './config/environment';
import { ENV_TOKEN } from './config/env.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const env = app.get<Environment>(ENV_TOKEN);

  app.setGlobalPrefix(API_ROUTE_PREFIX, {
    exclude: [{ path: UNPREFIXED_HEALTH_PATH, method: RequestMethod.ALL }],
  });

  // Behind a reverse proxy, req.ip and req.protocol must come from the
  // forwarded headers or every client looks like the same address.
  app.set('trust proxy', 1);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // mobile apps and curl send no Origin
      if (env.CORS_ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Idempotency-Key'],
    exposedHeaders: ['Set-Cookie'],
    maxAge: 600,
  });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.enableShutdownHooks();

  await app.listen(env.API_PORT, '0.0.0.0');
  new Logger(SERVICE_NAME).log(`v${API_VERSION} listening on ${await app.getUrl()}`);
}

void bootstrap();
