// =============================================================================
// API Response Types
// =============================================================================

import type { UUID } from './common';

/** Standard API success response */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId?: UUID;
  timestamp: string;
}

/** API response metadata */
export interface ApiMeta {
  requestId?: UUID;
  timestamp?: string;
  version?: string;
}

/** Health check status */
export type HealthStatus = 'ok' | 'degraded' | 'down';

/** Individual health check result */
export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
}

/** Full health report */
export interface HealthReport {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  checks: Record<string, HealthCheckResult>;
}
