// =============================================================================
// Dispatch, Route Planning & Trip Optimization Constants — Module 12
// =============================================================================

export const DISPATCH_PERMISSIONS = {
  DISPATCH_READ: 'trip.read',
  DISPATCH_ASSIGN: 'trip.dispatch',
  DISPATCH_BOARD: 'trip.dispatch',
  DISPATCH_ANALYTICS: 'trip.read',
  ROUTE_PLAN: 'trip.update',
  STOP_MANAGE: 'trip.update',
} as const;

export type DispatchPermission =
  (typeof DISPATCH_PERMISSIONS)[keyof typeof DISPATCH_PERMISSIONS];

/**
 * Socket.IO event names broadcasted on the /tracking namespace
 * scoped to tenant room `company:{companyId}`
 */
export const DISPATCH_EVENTS = {
  TRIP_ASSIGNED: 'dispatch.trip.assigned',
  TRIP_REASSIGNED: 'dispatch.trip.reassigned',
  TRIP_UNASSIGNED: 'dispatch.trip.unassigned',
  TRIP_DISPATCHED: 'dispatch.trip.dispatched',
  TRIP_STATUS_UPDATED: 'dispatch.trip.status.updated',
  ROUTE_UPDATED: 'dispatch.route.updated',
  ETA_UPDATED: 'dispatch.eta.updated',
  STOP_UPDATED: 'dispatch.stop.updated',
} as const;

export type DispatchEventType =
  (typeof DISPATCH_EVENTS)[keyof typeof DISPATCH_EVENTS];

/**
 * Stop / Waypoint classification
 */
export const STOP_TYPE = {
  PICKUP: 'PICKUP',
  WAYPOINT: 'WAYPOINT',
  DROPOFF: 'DROPOFF',
} as const;

export type StopTypeValue = (typeof STOP_TYPE)[keyof typeof STOP_TYPE];

/**
 * Stop execution state
 */
export const STOP_STATUS = {
  PENDING: 'PENDING',
  ARRIVED: 'ARRIVED',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
} as const;

export type StopStatusValue = (typeof STOP_STATUS)[keyof typeof STOP_STATUS];

/**
 * Redis keys for dispatch & route caching
 */
export const DISPATCH_REDIS_KEYS = {
  route: (coordsHash: string) => `dispatch:route:${coordsHash}`,
  eta: (tripId: string) => `dispatch:eta:${tripId}`,
  lockDriver: (driverId: string) => `dispatch:lock:driver:${driverId}`,
  lockVehicle: (vehicleId: string) => `dispatch:lock:vehicle:${vehicleId}`,
} as const;

/**
 * Default travel speed assumed for Mock routing calculations (km/h)
 */
export const DEFAULT_URBAN_SPEED_KMH = 35;

/**
 * Time buffer (minutes) surrounding scheduled start/end for conflict overlap detection
 */
export const DISPATCH_CONFLICT_BUFFER_MINUTES = 30;
