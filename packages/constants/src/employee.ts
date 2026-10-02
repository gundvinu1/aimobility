// =============================================================================
// Employee Management Constants — Module 4
// =============================================================================

/** Employment status values */
export const EMPLOYMENT_STATUS = {
  ACTIVE:     'ACTIVE',
  INACTIVE:   'INACTIVE',
  ON_LEAVE:   'ON_LEAVE',
  SUSPENDED:  'SUSPENDED',
  TERMINATED: 'TERMINATED',
} as const;

export type EmploymentStatusValue = (typeof EMPLOYMENT_STATUS)[keyof typeof EMPLOYMENT_STATUS];

/** Employment type values */
export const EMPLOYMENT_TYPE = {
  FULL_TIME:  'FULL_TIME',
  PART_TIME:  'PART_TIME',
  CONTRACT:   'CONTRACT',
  TEMPORARY:  'TEMPORARY',
  INTERN:     'INTERN',
} as const;

export type EmploymentTypeValue = (typeof EMPLOYMENT_TYPE)[keyof typeof EMPLOYMENT_TYPE];

/** Gender values */
export const GENDER = {
  MALE:              'MALE',
  FEMALE:            'FEMALE',
  OTHER:             'OTHER',
  PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY',
} as const;

export type GenderValue = (typeof GENDER)[keyof typeof GENDER];

/** Department values */
export const EMPLOYEE_DEPARTMENTS = {
  OPERATIONS:       'OPERATIONS',
  DISPATCH:         'DISPATCH',
  ACCOUNTS:         'ACCOUNTS',
  HR:               'HR',
  SALES:            'SALES',
  CUSTOMER_SUPPORT: 'CUSTOMER_SUPPORT',
  ADMINISTRATION:   'ADMINISTRATION',
  MANAGEMENT:       'MANAGEMENT',
  OTHER:            'OTHER',
} as const;

export type DepartmentValue = (typeof EMPLOYEE_DEPARTMENTS)[keyof typeof EMPLOYEE_DEPARTMENTS];

/** Module 4 permissions */
export const EMPLOYEE_PERMISSIONS = {
  EMPLOYEE_READ:        'employee.read',
  EMPLOYEE_CREATE:      'employee.create',
  EMPLOYEE_UPDATE:      'employee.update',
  EMPLOYEE_DELETE:      'employee.delete',
  EMPLOYEE_STATUS_WRITE: 'employee.status.write',
  EMPLOYEE_USER_LINK:   'employee.user.link',
} as const;

export type EmployeePermission = (typeof EMPLOYEE_PERMISSIONS)[keyof typeof EMPLOYEE_PERMISSIONS];

/** Audit event types for employee actions */
export const EMPLOYEE_AUDIT_EVENTS = {
  EMPLOYEE_CREATED:       'EMPLOYEE_CREATED',
  EMPLOYEE_UPDATED:       'EMPLOYEE_UPDATED',
  EMPLOYEE_STATUS_CHANGED: 'EMPLOYEE_STATUS_CHANGED',
  EMPLOYEE_DELETED:       'EMPLOYEE_DELETED',
  EMPLOYEE_USER_LINKED:   'EMPLOYEE_USER_LINKED',
  EMPLOYEE_USER_UNLINKED: 'EMPLOYEE_USER_UNLINKED',
} as const;

export type EmployeeAuditEvent = (typeof EMPLOYEE_AUDIT_EVENTS)[keyof typeof EMPLOYEE_AUDIT_EVENTS];

/** Allowed sort fields for employee list queries */
export const EMPLOYEE_SORT_FIELDS = [
  'firstName',
  'lastName',
  'employeeNumber',
  'joiningDate',
  'createdAt',
  'employmentStatus',
  'department',
] as const;

export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

/** Role access for employee operations
 *  OWNER / ADMIN → full management
 *  MANAGER       → read + create + update
 *  DISPATCHER    → read only
 *  ACCOUNTANT    → read only
 *  MEMBER        → no access
 */
export const EMPLOYEE_ROLE_ACCESS = {
  FULL:      ['OWNER', 'ADMIN'],
  READ_WRITE: ['OWNER', 'ADMIN', 'MANAGER'],
  READ_ONLY:  ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'ACCOUNTANT'],
} as const;
