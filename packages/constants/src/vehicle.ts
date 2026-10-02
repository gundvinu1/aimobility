// =============================================================================
// Vehicle Management Constants — Module 5
// =============================================================================

/** Vehicle operational status values */
export const VEHICLE_STATUS = {
  ACTIVE:      'ACTIVE',
  INACTIVE:    'INACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  RETIRED:     'RETIRED',
  ON_TRIP:     'ON_TRIP',
} as const;

export type VehicleStatusValue = (typeof VEHICLE_STATUS)[keyof typeof VEHICLE_STATUS];

/** Vehicle fuel type values */
export const FUEL_TYPE = {
  PETROL:   'PETROL',
  DIESEL:   'DIESEL',
  ELECTRIC: 'ELECTRIC',
  HYBRID:   'HYBRID',
  CNG:      'CNG',
  LPG:      'LPG',
  OTHER:    'OTHER',
} as const;

export type FuelTypeValue = (typeof FUEL_TYPE)[keyof typeof FUEL_TYPE];

/** Vehicle ownership type */
export const VEHICLE_OWNERSHIP = {
  OWNED:  'OWNED',
  LEASED: 'LEASED',
  RENTED: 'RENTED',
} as const;

export type VehicleOwnershipValue = (typeof VEHICLE_OWNERSHIP)[keyof typeof VEHICLE_OWNERSHIP];

/** Vehicle document type */
export const VEHICLE_DOCUMENT_TYPE = {
  REGISTRATION_CERTIFICATE: 'REGISTRATION_CERTIFICATE',
  INSURANCE:                'INSURANCE',
  POLLUTION_CERTIFICATE:    'POLLUTION_CERTIFICATE',
  FITNESS_CERTIFICATE:      'FITNESS_CERTIFICATE',
  PERMIT:                   'PERMIT',
  TAX_TOKEN:                'TAX_TOKEN',
  OTHER:                    'OTHER',
} as const;

export type VehicleDocumentTypeValue = (typeof VEHICLE_DOCUMENT_TYPE)[keyof typeof VEHICLE_DOCUMENT_TYPE];

/** Vehicle maintenance type */
export const MAINTENANCE_TYPE = {
  PREVENTIVE:  'PREVENTIVE',
  CORRECTIVE:  'CORRECTIVE',
  EMERGENCY:   'EMERGENCY',
  INSPECTION:  'INSPECTION',
  OTHER:       'OTHER',
} as const;

export type MaintenanceTypeValue = (typeof MAINTENANCE_TYPE)[keyof typeof MAINTENANCE_TYPE];

/** Vehicle maintenance status */
export const MAINTENANCE_STATUS = {
  SCHEDULED:   'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED:   'COMPLETED',
  CANCELLED:   'CANCELLED',
} as const;

export type MaintenanceStatusValue = (typeof MAINTENANCE_STATUS)[keyof typeof MAINTENANCE_STATUS];

/** Module 5 permissions */
export const VEHICLE_PERMISSIONS = {
  VEHICLE_READ:        'vehicle.read',
  VEHICLE_CREATE:      'vehicle.create',
  VEHICLE_UPDATE:      'vehicle.update',
  VEHICLE_DELETE:      'vehicle.delete',
  VEHICLE_STATUS_WRITE: 'vehicle.status.write',
  VEHICLE_DOC_MANAGE:  'vehicle.document.manage',
  VEHICLE_MAINT_MANAGE: 'vehicle.maintenance.manage',
} as const;

export type VehiclePermission = (typeof VEHICLE_PERMISSIONS)[keyof typeof VEHICLE_PERMISSIONS];

/** Audit event types for vehicle actions */
export const VEHICLE_AUDIT_EVENTS = {
  VEHICLE_CREATED:         'VEHICLE_CREATED',
  VEHICLE_UPDATED:         'VEHICLE_UPDATED',
  VEHICLE_STATUS_CHANGED:  'VEHICLE_STATUS_CHANGED',
  VEHICLE_DELETED:         'VEHICLE_DELETED',
  VEHICLE_DOC_ADDED:       'VEHICLE_DOC_ADDED',
  VEHICLE_DOC_DELETED:     'VEHICLE_DOC_DELETED',
  VEHICLE_MAINT_CREATED:   'VEHICLE_MAINT_CREATED',
  VEHICLE_MAINT_UPDATED:   'VEHICLE_MAINT_UPDATED',
  VEHICLE_MAINT_COMPLETED: 'VEHICLE_MAINT_COMPLETED',
} as const;

export type VehicleAuditEvent = (typeof VEHICLE_AUDIT_EVENTS)[keyof typeof VEHICLE_AUDIT_EVENTS];

/** Allowed sort fields for vehicle list queries */
export const VEHICLE_SORT_FIELDS = [
  'vehicleNumber',
  'make',
  'model',
  'year',
  'status',
  'createdAt',
] as const;

export type VehicleSortField = (typeof VEHICLE_SORT_FIELDS)[number];

/** Role access for vehicle operations */
export const VEHICLE_ROLE_ACCESS = {
  FULL:       ['OWNER', 'ADMIN'],
  READ_WRITE: ['OWNER', 'ADMIN', 'MANAGER'],
  READ_ONLY:  ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT'],
} as const;
