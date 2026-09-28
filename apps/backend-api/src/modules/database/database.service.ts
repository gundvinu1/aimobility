import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connection established');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * Check database health - used by health endpoints
   */
  async isHealthy(): Promise<{ status: 'ok' | 'down'; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', latencyMs: Date.now() - start };
    }
  }
}
