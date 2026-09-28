import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Liveness probe — confirms the application process is running.
   * Does NOT check infrastructure dependencies.
   */
  @Get('live')
  @ApiOperation({ summary: 'Liveness check', description: 'Returns OK if the application is running.' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  liveness() {
    return this.healthService.liveness();
  }

  /**
   * Readiness probe — confirms all required dependencies are reachable.
   * Used by load balancers and orchestrators to route traffic.
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check', description: 'Returns OK if all dependencies (DB, Redis) are reachable.' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'One or more dependencies unavailable' })
  async readiness() {
    return this.healthService.readiness();
  }
}
