// =============================================================================
// Driver Management Constants — Module 6
// =============================================================================

/** Driver operational status values */
export const DRIVER_STATUS = {
  ACTIVE:     'ACTIVE',
  INACTIVE:   'INACTIVE',
  SUSPENDED:  'SUSPENDED',
  TERMINATED: 'TERMINATED',
} as const;

export type DriverStatusValue = (typeof DRIVER_STATUS)[keyof typeof DRIVER_STATUS];

/** Driver duty status values */
export const DRIVER_DUTY_STATUS = {
  OFF_DUTY:    'OFF_DUTY',
  ON_DUTY:     'ON_DUTY',
  ON_TRIP:     'ON_TRIP',
  ON_BREAK:    'ON_BREAK',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export type DriverDutyStatusValue = (typeof DRIVER_DUTY_STATUS)[keyof typeof DRIVER_DUTY_STATUS];

/** Commercial driving license classification */
export const LICENSE_TYPE = {
  LMV:        'LMV',
  HMV:        'HMV',
  COMMERCIAL: 'COMMERCIAL',
  TRANSPORT:  'TRANSPORT',
  OTHER:      'OTHER',
} as const;

export type LicenseTypeValue = (typeof LICENSE_TYPE)[keyof typeof LICENSE_TYPE];

/** Driver document types */
export const DRIVER_DOCUMENT_TYPE = {
  DRIVING_LICENSE:     'DRIVING_LICENSE',
  BADGE:               'BADGE',
  POLICE_VERIFICATION: 'POLICE_VERIFICATION',
  MEDICAL_CERTIFICATE: 'MEDICAL_CERTIFICATE',
  IDENTITY_PROOF:      'IDENTITY_PROOF',
  ADDRESS_PROOF:       'ADDRESS_PROOF',
  OTHER:               'OTHER',
} as const;

export type DriverDocumentTypeValue = (typeof DRIVER_DOCUMENT_TYPE)[keyof typeof DRIVER_DOCUMENT_TYPE];

/** Module 6 permissions */
export const DRIVER_PERMISSIONS = {
  DRIVER_READ:            'driver.read',
  DRIVER_CREATE:          'driver.create',
  DRIVER_UPDATE:          'driver.update',
  DRIVER_DELETE:          'driver.delete',
  DRIVER_STATUS_UPDATE:   'driver.status.update',
  DRIVER_DUTY_UPDATE:     'driver.duty.update',
  DRIVER_DOCUMENTS_READ:  'driver.documents.read',
  DRIVER_DOCUMENTS_WRITE: 'driver.documents.write',
  DRIVER_VEHICLE_ASSIGN:  'driver.vehicle.assign',
} as const;

export type DriverPermission = (typeof DRIVER_PERMISSIONS)[keyof typeof DRIVER_PERMISSIONS];

/** Audit event types for driver actions */
export const DRIVER_AUDIT_EVENTS = {
  DRIVER_CREATED:              'DRIVER_CREATED',
  DRIVER_UPDATED:              'DRIVER_UPDATED',
  DRIVER_DELETED:              'DRIVER_DELETED',
  DRIVER_STATUS_CHANGED:       'DRIVER_STATUS_CHANGED',
  DRIVER_DUTY_STATUS_CHANGED:  'DRIVER_DUTY_STATUS_CHANGED',
  DRIVER_DOCUMENT_ADDED:       'DRIVER_DOCUMENT_ADDED',
  DRIVER_DOCUMENT_UPDATED:     'DRIVER_DOCUMENT_UPDATED',
  DRIVER_DOCUMENT_DELETED:     'DRIVER_DOCUMENT_DELETED',
  DRIVER_VEHICLE_ASSIGNED:     'DRIVER_VEHICLE_ASSIGNED',
  DRIVER_VEHICLE_UNASSIGNED:   'DRIVER_VEHICLE_UNASSIGNED',
} as const;

export type DriverAuditEvent = (typeof DRIVER_AUDIT_EVENTS)[keyof typeof DRIVER_AUDIT_EVENTS];

/** Allowed sort fields for driver list queries */
export const DRIVER_SORT_FIELDS = [
  'driverCode',
  'licenseNumber',
  'licenseExpiryDate',
  'experienceYears',
  'joiningDate',
  'status',
  'dutyStatus',
  'createdAt',
] as const;

export type DriverSortField = (typeof DRIVER_SORT_FIELDS)[number];

/** Role access definitions for driver operations */
export const DRIVER_ROLE_ACCESS = {
  FULL:           ['OWNER', 'ADMIN'],
  READ_WRITE:     ['OWNER', 'ADMIN', 'MANAGER'],
  DUTY_UPDATE:    ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER'],
  VEHICLE_ASSIGN: ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER'],
  READ_ONLY:      ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT'],
} as const;
