// =============================================================================
// Booking Management Constants — Module 7
// =============================================================================

/** Booking lifecycle status values */
export const BOOKING_STATUS = {
  DRAFT:     'DRAFT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;

export type BookingStatusValue = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

/** Booking source channels */
export const BOOKING_SOURCE = {
  WEB:    'WEB',
  MOBILE: 'MOBILE',
  ADMIN:  'ADMIN',
  PHONE:  'PHONE',
  API:    'API',
} as const;

export type BookingSourceValue = (typeof BOOKING_SOURCE)[keyof typeof BOOKING_SOURCE];

/** Module 7 Booking permissions */
export const BOOKING_PERMISSIONS = {
  BOOKING_READ:    'booking.read',
  BOOKING_CREATE:  'booking.create',
  BOOKING_UPDATE:  'booking.update',
  BOOKING_DELETE:  'booking.delete',
  BOOKING_CONFIRM: 'booking.confirm',
  BOOKING_CANCEL:  'booking.cancel',
} as const;

export type BookingPermission = (typeof BOOKING_PERMISSIONS)[keyof typeof BOOKING_PERMISSIONS];

/** Audit event types for booking actions */
export const BOOKING_AUDIT_EVENTS = {
  BOOKING_CREATED:   'BOOKING_CREATED',
  BOOKING_UPDATED:   'BOOKING_UPDATED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_COMPLETED: 'BOOKING_COMPLETED',
  BOOKING_DELETED:   'BOOKING_DELETED',
} as const;

export type BookingAuditEvent = (typeof BOOKING_AUDIT_EVENTS)[keyof typeof BOOKING_AUDIT_EVENTS];

/** Allowed sort fields for booking list queries */
export const BOOKING_SORT_FIELDS = [
  'bookingNumber',
  'bookingDate',
  'pickupTime',
  'customerName',
  'status',
  'createdAt',
] as const;

export type BookingSortField = (typeof BOOKING_SORT_FIELDS)[number];

/** Role access definitions for booking operations */
export const BOOKING_ROLE_ACCESS = {
  FULL:      ['OWNER', 'ADMIN'],
  MANAGE:    ['OWNER', 'ADMIN', 'MANAGER'],
  DISPATCH:  ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER'],
  READ_ONLY: ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT'],
} as const;
