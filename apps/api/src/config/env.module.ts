import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parseEnvironment, type Environment } from './environment';

export const ENV_TOKEN = 'SERE_ENV';

/**
 * Validates the process environment once at boot and exposes the typed result
 * as a provider. A malformed value stops the process instead of degrading into
 * an insecure default.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
  ],
  providers: [
    {
      provide: ENV_TOKEN,
      // ConfigModule.forRoot has already loaded .env into process.env.
      useFactory: (): Environment => parseEnvironment(process.env),
    },
  ],
  exports: [ENV_TOKEN],
})
export class EnvModule {}
