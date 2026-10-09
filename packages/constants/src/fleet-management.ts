// =============================================================================
// Fleet Management Constants — Module 11 (Fuel, Maintenance, Work Orders, TCO)
// =============================================================================

export const FLEET_MANAGEMENT_PERMISSIONS = {
  // Fuel Management
  FUEL_READ: 'fuel.read',
  FUEL_CREATE: 'fuel.create',
  FUEL_UPDATE: 'fuel.update',
  FUEL_DELETE: 'fuel.delete',

  // Preventive Maintenance
  MAINTENANCE_READ: 'maintenance.read',
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_UPDATE: 'maintenance.update',
  MAINTENANCE_DELETE: 'maintenance.delete',
  MAINTENANCE_CONFIGURE: 'maintenance.configure',

  // Work Orders
  WORKORDER_READ: 'workorder.read',
  WORKORDER_CREATE: 'workorder.create',
  WORKORDER_UPDATE: 'workorder.update',
  WORKORDER_DELETE: 'workorder.delete',

  // Vendors
  VENDOR_READ: 'vendor.read',
  VENDOR_CREATE: 'vendor.create',
  VENDOR_UPDATE: 'vendor.update',
  VENDOR_DELETE: 'vendor.delete',

  // Invoices
  INVOICE_READ: 'invoice.read',
  INVOICE_CREATE: 'invoice.create',
  INVOICE_UPDATE: 'invoice.update',

  // Vehicle Expenses
  EXPENSE_READ: 'expense.read',
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_UPDATE: 'expense.update',
  EXPENSE_DELETE: 'expense.delete',

  // TCO Analytics
  TCO_READ: 'tco.read',
} as const;

export type FleetManagementPermission =
  (typeof FLEET_MANAGEMENT_PERMISSIONS)[keyof typeof FLEET_MANAGEMENT_PERMISSIONS];

export const FUEL_TRANSACTION_SOURCES = {
  MANUAL: 'MANUAL',
  TELEMATICS: 'TELEMATICS',
  FUEL_CARD: 'FUEL_CARD',
  IMPORT: 'IMPORT',
} as const;

export const VENDOR_TYPES = {
  SERVICE_CENTER: 'SERVICE_CENTER',
  MECHANIC: 'MECHANIC',
  FUEL_STATION: 'FUEL_STATION',
  PARTS_SUPPLIER: 'PARTS_SUPPLIER',
  OTHER: 'OTHER',
} as const;

export const WORK_ORDER_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export const WORK_ORDER_STATUSES = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const WORK_ORDER_ITEM_TYPES = {
  PARTS: 'PARTS',
  LABOR: 'LABOR',
  OTHER: 'OTHER',
} as const;

export const VENDOR_INVOICE_STATUSES = {
  DRAFT: 'DRAFT',
  RECEIVED: 'RECEIVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;

export const VEHICLE_EXPENSE_CATEGORIES = {
  FUEL: 'FUEL',
  MAINTENANCE: 'MAINTENANCE',
  REPAIR: 'REPAIR',
  PARTS: 'PARTS',
  INSURANCE: 'INSURANCE',
  TAX: 'TAX',
  TOLL: 'TOLL',
  PARKING: 'PARKING',
  CLEANING: 'CLEANING',
  OTHER: 'OTHER',
} as const;

export const MAINTENANCE_DUE_STATUSES = {
  UPCOMING: 'UPCOMING',
  DUE_SOON: 'DUE_SOON',
  DUE: 'DUE',
  OVERDUE: 'OVERDUE',
  COMPLETED: 'COMPLETED',
} as const;

export const FLEET_MANAGEMENT_AUDIT_EVENTS = {
  FUEL_TRANSACTION_CREATED: 'FUEL_TRANSACTION_CREATED',
  FUEL_TRANSACTION_UPDATED: 'FUEL_TRANSACTION_UPDATED',
  FUEL_TRANSACTION_DELETED: 'FUEL_TRANSACTION_DELETED',

  MAINTENANCE_SCHEDULE_CREATED: 'MAINTENANCE_SCHEDULE_CREATED',
  MAINTENANCE_SCHEDULE_UPDATED: 'MAINTENANCE_SCHEDULE_UPDATED',
  MAINTENANCE_SCHEDULE_DELETED: 'MAINTENANCE_SCHEDULE_DELETED',

  MAINTENANCE_RECORD_CREATED: 'MAINTENANCE_RECORD_CREATED',

  WORK_ORDER_CREATED: 'WORK_ORDER_CREATED',
  WORK_ORDER_UPDATED: 'WORK_ORDER_UPDATED',
  WORK_ORDER_STATUS_CHANGED: 'WORK_ORDER_STATUS_CHANGED',

  VENDOR_CREATED: 'VENDOR_CREATED',
  VENDOR_UPDATED: 'VENDOR_UPDATED',
  VENDOR_DELETED: 'VENDOR_DELETED',

  VENDOR_INVOICE_CREATED: 'VENDOR_INVOICE_CREATED',
  VENDOR_INVOICE_UPDATED: 'VENDOR_INVOICE_UPDATED',

  VEHICLE_EXPENSE_CREATED: 'VEHICLE_EXPENSE_CREATED',
  VEHICLE_EXPENSE_UPDATED: 'VEHICLE_EXPENSE_UPDATED',
  VEHICLE_EXPENSE_DELETED: 'VEHICLE_EXPENSE_DELETED',
} as const;

export const FLEET_MANAGEMENT_REDIS_KEYS = {
  fuelDropState: (vehicleId: string) => `tracking:fuel_drop:${vehicleId}`,
  maintenanceDueDedupe: (scheduleId: string) => `alert:maintenance_due:${scheduleId}`,
  analyticsCache: (companyId: string, range: string) => `analytics:fleet_costs:${companyId}:${range}`,
} as const;
