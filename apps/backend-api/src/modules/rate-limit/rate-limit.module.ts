import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60_000,    // 1 minute
        limit: 120,     // 120 requests per minute per IP
      },
      {
        name: 'medium',
        ttl: 600_000,   // 10 minutes
        limit: 600,     // 600 requests per 10 minutes per IP
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class RateLimitModule {}
