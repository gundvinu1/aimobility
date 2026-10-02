// =============================================================================
// Trip Management Constants — Module 7
// =============================================================================

/** Trip operational type */
export const TRIP_TYPE = {
  ONE_WAY:          'ONE_WAY',
  ROUND_TRIP:       'ROUND_TRIP',
  RENTAL:           'RENTAL',
  OUTSTATION:       'OUTSTATION',
  AIRPORT_TRANSFER: 'AIRPORT_TRANSFER',
} as const;

export type TripTypeValue = (typeof TRIP_TYPE)[keyof typeof TRIP_TYPE];

/** Trip operational lifecycle status */
export const TRIP_STATUS = {
  SCHEDULED:        'SCHEDULED',
  DRIVER_ASSIGNED:  'DRIVER_ASSIGNED',
  VEHICLE_ASSIGNED: 'VEHICLE_ASSIGNED',
  DISPATCHED:       'DISPATCHED',
  DRIVER_ARRIVED:   'DRIVER_ARRIVED',
  PASSENGER_ONBOARD:'PASSENGER_ONBOARD',
  IN_PROGRESS:      'IN_PROGRESS',
  COMPLETED:        'COMPLETED',
  CANCELLED:        'CANCELLED',
  NO_SHOW:          'NO_SHOW',
} as const;

export type TripStatusValue = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];

/** Allowed state transitions for trip lifecycle */
export const VALID_TRIP_TRANSITIONS: Record<TripStatusValue, readonly TripStatusValue[]> = {
  SCHEDULED:         ['DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED', 'DISPATCHED', 'CANCELLED'],
  DRIVER_ASSIGNED:   ['VEHICLE_ASSIGNED', 'DISPATCHED', 'SCHEDULED', 'CANCELLED'],
  VEHICLE_ASSIGNED:  ['DRIVER_ASSIGNED', 'DISPATCHED', 'SCHEDULED', 'CANCELLED'],
  DISPATCHED:        ['DRIVER_ARRIVED', 'IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  DRIVER_ARRIVED:    ['PASSENGER_ONBOARD', 'IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  PASSENGER_ONBOARD: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS:       ['COMPLETED', 'CANCELLED'],
  COMPLETED:         [],
  CANCELLED:         [],
  NO_SHOW:           [],
} as const;

/** Module 7 Trip permissions */
export const TRIP_PERMISSIONS = {
  TRIP_READ:           'trip.read',
  TRIP_CREATE:         'trip.create',
  TRIP_UPDATE:         'trip.update',
  TRIP_DELETE:         'trip.delete',
  TRIP_ASSIGN_DRIVER:  'trip.assign.driver',
  TRIP_ASSIGN_VEHICLE: 'trip.assign.vehicle',
  TRIP_DISPATCH:       'trip.dispatch',
  TRIP_UPDATE_STATUS:  'trip.update.status',
  TRIP_CANCEL:         'trip.cancel',
} as const;

export type TripPermission = (typeof TRIP_PERMISSIONS)[keyof typeof TRIP_PERMISSIONS];

/** Audit event types for trip actions */
export const TRIP_AUDIT_EVENTS = {
  TRIP_CREATED:            'TRIP_CREATED',
  TRIP_UPDATED:            'TRIP_UPDATED',
  TRIP_DELETED:            'TRIP_DELETED',
  TRIP_DRIVER_ASSIGNED:    'TRIP_DRIVER_ASSIGNED',
  TRIP_DRIVER_UNASSIGNED:  'TRIP_DRIVER_UNASSIGNED',
  TRIP_VEHICLE_ASSIGNED:   'TRIP_VEHICLE_ASSIGNED',
  TRIP_VEHICLE_UNASSIGNED: 'TRIP_VEHICLE_UNASSIGNED',
  TRIP_DISPATCHED:         'TRIP_DISPATCHED',
  TRIP_STATUS_UPDATED:     'TRIP_STATUS_UPDATED',
  TRIP_CANCELLED:          'TRIP_CANCELLED',
  TRIP_COMPLETED:          'TRIP_COMPLETED',
} as const;

export type TripAuditEvent = (typeof TRIP_AUDIT_EVENTS)[keyof typeof TRIP_AUDIT_EVENTS];

/** Allowed sort fields for trip list queries */
export const TRIP_SORT_FIELDS = [
  'tripNumber',
  'tripType',
  'status',
  'scheduledStartTime',
  'scheduledEndTime',
  'actualStartTime',
  'actualEndTime',
  'createdAt',
] as const;

export type TripSortField = (typeof TRIP_SORT_FIELDS)[number];

/** Role access definitions for trip operations */
export const TRIP_ROLE_ACCESS = {
  FULL:        ['OWNER', 'ADMIN'],
  DISPATCH:    ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER'],
  EXECUTE:     ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER'],
  READ_ONLY:   ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT'],
} as const;
