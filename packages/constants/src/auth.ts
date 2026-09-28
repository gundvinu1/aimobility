// =============================================================================
// Authentication Constants
// =============================================================================

/** Platform roles */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  DISPATCHER: 'DISPATCHER',
  ACCOUNTANT: 'ACCOUNTANT',
  DRIVER: 'DRIVER',
  CUSTOMER: 'CUSTOMER',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** Module 2 permissions (others will be added per module) */
export const PERMISSIONS = {
  // User management
  USER_READ: 'user.read',
  USER_WRITE: 'user.write',
  USER_DELETE: 'user.delete',

  // Profile
  PROFILE_READ: 'profile.read',
  PROFILE_WRITE: 'profile.write',

  // Role management
  ROLE_READ: 'role.read',
  ROLE_WRITE: 'role.write',

  // Permission management
  PERMISSION_READ: 'permission.read',
  PERMISSION_WRITE: 'permission.write',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Audit event types for auth actions */
export const AUTH_AUDIT_EVENTS = {
  REGISTER: 'AUTH_REGISTER',
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  LOGOUT: 'AUTH_LOGOUT',
  LOGOUT_ALL: 'AUTH_LOGOUT_ALL',
  PASSWORD_CHANGED: 'AUTH_PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'AUTH_PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET: 'AUTH_PASSWORD_RESET',
  EMAIL_VERIFIED: 'AUTH_EMAIL_VERIFIED',
  REFRESH: 'AUTH_REFRESH',
  SESSION_REVOKED: 'AUTH_SESSION_REVOKED',
} as const;

export type AuthAuditEvent = (typeof AUTH_AUDIT_EVENTS)[keyof typeof AUTH_AUDIT_EVENTS];

/** User statuses */
export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];
