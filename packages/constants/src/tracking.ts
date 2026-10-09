// =============================================================================
// Fleet Tracking & Telemetry Constants — Module 9
// =============================================================================

/**
 * Tracking permissions — integrated with the Module 8A/8B permission catalog.
 * These tokens must be seeded into the permissions table.
 */
export const TRACKING_PERMISSIONS = {
  /** Can access fleet tracking page */
  FLEET_TRACKING_READ: 'fleet.tracking.read',
  /** Can receive real-time WebSocket updates */
  FLEET_TRACKING_LIVE: 'fleet.tracking.live',
  /** Can view historical telemetry data */
  VEHICLE_TELEMETRY_READ: 'vehicle.telemetry.read',
  /** Can submit telemetry data (devices / service accounts) */
  VEHICLE_TELEMETRY_WRITE: 'vehicle.telemetry.write',
  /** Can view a vehicle's current GPS location */
  VEHICLE_LOCATION_READ: 'vehicle.location.read',
  /** Can receive live vehicle location updates */
  VEHICLE_LOCATION_LIVE: 'vehicle.location.live',
} as const;

export type TrackingPermission =
  (typeof TRACKING_PERMISSIONS)[keyof typeof TRACKING_PERMISSIONS];

/**
 * Number of seconds without a telemetry event before a vehicle
 * is considered OFFLINE in the fleet tracking view.
 *
 * Configurable: override via TELEMETRY_OFFLINE_THRESHOLD_SECONDS env var.
 * Default: 5 minutes (300 seconds).
 */
export const TELEMETRY_OFFLINE_THRESHOLD_SECONDS = 300;

/**
 * Maximum number of historical telemetry records returned per page.
 * Prevents unbounded queries on high-frequency telemetry tables.
 */
export const TELEMETRY_MAX_PAGE_SIZE = 500;

/**
 * Default time window for telemetry history queries (hours).
 * Clients must explicitly request longer windows.
 */
export const TELEMETRY_DEFAULT_WINDOW_HOURS = 24;

/**
 * Redis key patterns for fleet tracking state.
 */
export const TRACKING_REDIS_KEYS = {
  vehicleLocation: (vehicleId: string) => `vehicle:location:${vehicleId}`,
  companyFleet: (companyId: string) => `company:fleet:${companyId}`,
} as const;

/**
 * WebSocket events emitted by the tracking gateway.
 */
export const TRACKING_EVENTS = {
  VEHICLE_LOCATION_UPDATED: 'vehicle.location.updated',
  VEHICLE_STATUS_UPDATED: 'vehicle.status.updated',
  DRIVER_LOCATION_UPDATED: 'driver.location.updated',
  TRIP_LOCATION_UPDATED: 'trip.location.updated',
  FLEET_SNAPSHOT: 'fleet.snapshot',
} as const;

/**
 * WebSocket namespace for fleet tracking.
 */
export const TRACKING_NAMESPACE = '/tracking';
