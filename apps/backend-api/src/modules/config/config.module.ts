import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validate } from './env.validation';
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [appConfig, databaseConfig, redisConfig],
      cache: true,
    }),
  ],
})
export class AppConfigModule {}
