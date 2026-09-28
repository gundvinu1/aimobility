import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => this.logger.log('✅ Redis connection established'));
    this.client.on('error', (err: Error) => this.logger.error('Redis error', err.message));
    this.client.on('close', () => this.logger.warn('Redis connection closed'));

    void this.client.connect().catch((err: Error) => {
      this.logger.error('Failed to connect to Redis', err.message);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis connection closed gracefully');
  }

  /**
   * Get the raw Redis client (for advanced operations)
   */
  getClient(): Redis {
    return this.client;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }

  /**
   * Check Redis health - used by health endpoints
   */
  async isHealthy(): Promise<{ status: 'ok' | 'down'; latencyMs: number }> {
    const start = Date.now();
    try {
      const pong = await this.client.ping();
      if (pong !== 'PONG') throw new Error('Unexpected PING response');
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', latencyMs: Date.now() - start };
    }
  }
}
