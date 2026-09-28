import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  /**
   * Basic process metrics endpoint.
   * Future: integrate Prometheus/OpenTelemetry in the Observability module.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'System metrics', description: 'Returns basic process and runtime metrics.' })
  @ApiResponse({ status: 200, description: 'Metrics data' })
  getMetrics() {
    const memUsage = process.memoryUsage();
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        rssHuman: formatBytes(memUsage.rss),
        heapUsedHuman: formatBytes(memUsage.heapUsed),
      },
    };
  }
}

function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}
