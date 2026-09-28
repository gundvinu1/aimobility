import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { APP_NAME } from '@ai-mos/constants';

@Injectable()
export class HealthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  liveness() {
    return {
      status: 'ok',
      service: APP_NAME,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }

  async readiness() {
    const [dbHealth, redisHealth] = await Promise.all([
      this.db.isHealthy(),
      this.cache.isHealthy(),
    ]);

    const allHealthy = dbHealth.status === 'ok' && redisHealth.status === 'ok';

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbHealth.status,
          latencyMs: dbHealth.latencyMs,
        },
        redis: {
          status: redisHealth.status,
          latencyMs: redisHealth.latencyMs,
        },
      },
    };
  }
}
