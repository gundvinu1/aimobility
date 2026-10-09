import { Injectable, Logger, Optional } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { MockRoutingProvider } from './mock-routing.provider';
import type {
  RoutingProvider,
  RoutePoint,
  CalculatedRoute,
  CalculatedEta,
} from './routing.interface';
import { DISPATCH_REDIS_KEYS } from '@ai-mos/constants';
import * as crypto from 'crypto';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private provider: RoutingProvider;

  constructor(
    private readonly mockProvider: MockRoutingProvider,
    @Optional() private readonly cacheService?: CacheService,
  ) {
    this.provider = this.mockProvider;
  }

  /**
   * Set custom routing provider (e.g., OSRM or Google Routes)
   */
  setProvider(provider: RoutingProvider): void {
    this.provider = provider;
  }

  /**
   * Generate deterministic cache key hash for route points
   */
  private generateHash(
    origin: RoutePoint,
    destination: RoutePoint,
    waypoints: RoutePoint[] = [],
  ): string {
    const raw = `${origin.latitude},${origin.longitude}:${destination.latitude},${destination.longitude}:${waypoints.map((w) => `${w.latitude},${w.longitude}`).join(';')}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  /**
   * Calculate route with Redis caching and graceful fallback to Mock provider
   */
  async calculateRoute(
    origin: RoutePoint,
    destination: RoutePoint,
    waypoints: RoutePoint[] = [],
  ): Promise<CalculatedRoute> {
    const hash = this.generateHash(origin, destination, waypoints);
    const cacheKey = DISPATCH_REDIS_KEYS.route(hash);

    // 1. Check Redis cache
    if (this.cacheService) {
      try {
        const cached = await this.cacheService.get<CalculatedRoute>(cacheKey);
        if (cached) {
          this.logger.debug(`Route cache hit: ${cacheKey}`);
          return cached;
        }
      } catch (err: unknown) {
        this.logger.warn(`Redis get error, proceeding without cache: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. Compute route via provider with fallback
    let result: CalculatedRoute;
    try {
      result = await this.provider.calculateRoute(origin, destination, waypoints);
    } catch (err: unknown) {
      this.logger.error(
        `Primary routing provider failed, falling back to mock provider: ${err instanceof Error ? err.message : String(err)}`,
      );
      result = await this.mockProvider.calculateRoute(origin, destination, waypoints);
    }

    // 3. Cache result for 24 hours
    if (this.cacheService) {
      try {
        await this.cacheService.set(cacheKey, result, 86400);
      } catch (err: unknown) {
        this.logger.warn(`Redis set error for route cache: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return result;
  }

  /**
   * Calculate dynamic ETA with graceful fallback
   */
  async calculateEta(
    currentLocation: RoutePoint,
    destination: RoutePoint,
  ): Promise<CalculatedEta> {
    try {
      return await this.provider.calculateEta(currentLocation, destination);
    } catch (err: unknown) {
      this.logger.error(
        `Primary ETA provider failed, falling back to mock provider: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.mockProvider.calculateEta(currentLocation, destination);
    }
  }
}
