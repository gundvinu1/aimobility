// =============================================================================
// Fleet Alert & Geofencing Constants — Module 10
// =============================================================================

/**
 * Geofence permissions — integrated with the Module 8A/8B/9 permission catalog.
 */
export const GEOFENCE_PERMISSIONS = {
  /** Can view geofences and assigned vehicles */
  GEOFENCE_READ: 'geofence.read',
  /** Can create new geofences */
  GEOFENCE_CREATE: 'geofence.create',
  /** Can update geofence geometries and settings */
  GEOFENCE_UPDATE: 'geofence.update',
  /** Can delete or deactivate geofences */
  GEOFENCE_DELETE: 'geofence.delete',
} as const;

export type GeofencePermission =
  (typeof GEOFENCE_PERMISSIONS)[keyof typeof GEOFENCE_PERMISSIONS];

/**
 * Alert permissions — integrated with the Module 8A/8B/9 permission catalog.
 */
export const ALERT_PERMISSIONS = {
  /** Can view fleet alerts and statistics */
  ALERT_READ: 'alert.read',
  /** Can acknowledge operational alerts */
  ALERT_ACKNOWLEDGE: 'alert.acknowledge',
  /** Can resolve or dismiss operational alerts */
  ALERT_RESOLVE: 'alert.resolve',
  /** Can configure company alert thresholds and safety rules */
  ALERT_CONFIGURE: 'alert.configure',
} as const;

export type AlertPermission =
  (typeof ALERT_PERMISSIONS)[keyof typeof ALERT_PERMISSIONS];

/**
 * Geofence geometric types
 */
export const GEOFENCE_TYPES = {
  CIRCLE: 'CIRCLE',
  POLYGON: 'POLYGON',
} as const;

export type GeofenceType = (typeof GEOFENCE_TYPES)[keyof typeof GEOFENCE_TYPES];

/**
 * Fleet alert event types
 */
export const FLEET_ALERT_TYPES = {
  GEOFENCE_ENTRY: 'GEOFENCE_ENTRY',
  GEOFENCE_EXIT: 'GEOFENCE_EXIT',
  OVERSPEED: 'OVERSPEED',
  HARSH_BRAKING: 'HARSH_BRAKING',
  EXCESSIVE_IDLE: 'EXCESSIVE_IDLE',
  FUEL_DROP: 'FUEL_DROP',
  MAINTENANCE_DUE: 'MAINTENANCE_DUE',
} as const;

export type FleetAlertType =
  (typeof FLEET_ALERT_TYPES)[keyof typeof FLEET_ALERT_TYPES];

/**
 * Fleet alert severity levels
 */
export const FLEET_ALERT_SEVERITIES = {
  INFO: 'INFO',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type FleetAlertSeverity =
  (typeof FLEET_ALERT_SEVERITIES)[keyof typeof FLEET_ALERT_SEVERITIES];

/**
 * Fleet alert lifecycle statuses
 */
export const FLEET_ALERT_STATUSES = {
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
} as const;

export type FleetAlertStatus =
  (typeof FLEET_ALERT_STATUSES)[keyof typeof FLEET_ALERT_STATUSES];

/**
 * Default operational thresholds for fleet safety rules.
 */
export const ALERT_DEFAULTS = {
  /** Speed in km/h above which overspeed alert is triggered */
  OVERSPEED_THRESHOLD_KMH: 80.0,
  /** Seconds above threshold before overspeed alert is confirmed (grace period) */
  OVERSPEED_GRACE_PERIOD_SECONDS: 10,
  /** Minimum deceleration rate in km/h per second indicating harsh braking (~5.56 m/s²) */
  HARSH_BRAKING_THRESHOLD_KMH_PER_SEC: 20.0,
  /** Idle duration in minutes (ignition ON, speed <= threshold) before idle alert */
  EXCESSIVE_IDLE_MINUTES: 15,
  /** Speed in km/h considered stationary for idle evaluation */
  IDLE_SPEED_THRESHOLD_KMH: 3.0,
  /** Default fuel drop threshold in liters */
  FUEL_DROP_THRESHOLD_LITERS: 10.0,
  /** Days before due date to trigger due soon alert */
  MAINTENANCE_DUE_SOON_DAYS: 14,
  /** Km before due odometer to trigger due soon alert */
  MAINTENANCE_DUE_SOON_KM: 500,
  /** Cooldown in seconds between repeated alerts of the same type for a vehicle */
  ALERT_COOLDOWN_SECONDS: 60,
} as const;

/**
 * Redis key patterns for alert state, deduplication, and geofence tracking.
 */
export const ALERT_REDIS_KEYS = {
  /** Active overspeed tracking: vehicleId -> { firstExceededAt: string, speed: number } */
  vehicleOverspeed: (vehicleId: string) => `alert:overspeed:${vehicleId}`,
  /** Active idle tracking: vehicleId -> { startedAt: string, alerted: boolean } */
  vehicleIdle: (vehicleId: string) => `alert:idle:${vehicleId}`,
  /** Set of geofence IDs the vehicle is currently inside */
  vehicleInsideGeofences: (vehicleId: string) => `alert:geofences:inside:${vehicleId}`,
  /** Deduplication cooldown key for vehicle and alert type */
  alertCooldown: (vehicleId: string, alertType: string) =>
    `alert:cooldown:${vehicleId}:${alertType}`,
  /** Fuel drop tracking: vehicleId -> { lastFuelLevel: number, timestamp: string } */
  fuelDropState: (vehicleId: string) => `alert:fuel_drop:${vehicleId}`,
  /** Maintenance reminder deduplication: scheduleId -> string */
  maintenanceDueAlert: (scheduleId: string) => `alert:maintenance_due:${scheduleId}`,
} as const;

/**
 * Real-time WebSocket events for fleet alerts.
 * Emitted over the existing /tracking namespace to the company room `company:${companyId}`.
 */
export const ALERT_EVENTS = {
  FLEET_ALERT_CREATED: 'fleet.alert.created',
  FLEET_ALERT_UPDATED: 'fleet.alert.updated',
  FLEET_ALERT_ACKNOWLEDGED: 'fleet.alert.acknowledged',
  FLEET_ALERT_RESOLVED: 'fleet.alert.resolved',
} as const;
