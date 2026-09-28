import { Module } from '@nestjs/common';

import { AppConfigModule } from './modules/config/config.module';
import { AppLoggerModule } from './modules/logger/logger.module';
import { DatabaseModule } from './modules/database/database.module';
import { CacheModule } from './modules/cache/cache.module';
import { QueueModule } from './modules/queue/queue.module';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './modules/common/common.module';

@Module({
  imports: [
    // Core infrastructure modules - order matters
    AppConfigModule,
    AppLoggerModule,
    DatabaseModule,
    CacheModule,
    QueueModule,
    HealthModule,
    CommonModule,
  ],
})
export class AppModule {}
