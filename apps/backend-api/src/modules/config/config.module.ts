import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

import { validate } from './env.validation';
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';

// Resolve the monorepo root .env regardless of whether we're running
// from ts-node (src/) or compiled output (dist/).
// Both are 5 levels deep from the monorepo root.
const ROOT_ENV = join(__dirname, '..', '..', '..', '..', '..', '.env');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [appConfig, databaseConfig, redisConfig],
      cache: true,
      // Array — NestJS loads the first file that exists; later files are ignored
      envFilePath: [
        '.env',       // local override (if running from project root)
        ROOT_ENV,     // monorepo root .env
      ],
    }),
  ],
})
export class AppConfigModule {}
