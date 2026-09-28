import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AppConfigModule } from './modules/config/config.module';
import { AppLoggerModule } from './modules/logger/logger.module';
import { DatabaseModule } from './modules/database/database.module';
import { CacheModule } from './modules/cache/cache.module';
import { QueueModule } from './modules/queue/queue.module';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './modules/common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    // Core infrastructure modules - order matters
    AppConfigModule,
    AppLoggerModule,
    DatabaseModule,
    CacheModule,
    QueueModule,
    RateLimitModule,
    HealthModule,
    CommonModule,
    // Business modules
    AuthModule,
  ],
  providers: [
    // Apply JWT guard globally — use @Public() to opt-out
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
