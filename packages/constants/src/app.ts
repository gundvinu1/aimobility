// =============================================================================
// Application Constants
// =============================================================================

export const APP_NAME = 'AI-MOS' as const;
export const APP_FULL_NAME = 'AI Mobility Operating System' as const;
export const APP_VERSION = '0.1.0' as const;
export const APP_DESCRIPTION = 'Enterprise SaaS Platform for Mobility Businesses' as const;

/** Default pagination values */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/** Environment names */
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;
