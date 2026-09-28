// =============================================================================
// Authentication & Authorization Types
// =============================================================================

import type { UUID } from './common';

/** User status values */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

/** Minimal user shape returned in responses */
export interface UserDto {
  id: UUID;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
}

/** Role shape */
export interface RoleDto {
  id: UUID;
  name: string;
  description?: string | null;
}

/** Permission shape */
export interface PermissionDto {
  id: UUID;
  name: string;
  description?: string | null;
}

/** Current authenticated user (full profile) */
export interface CurrentUserDto extends UserDto {
  roles: string[];
  permissions: string[];
}

/** Auth response returned on login / refresh */
export interface AuthTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/** Registration request */
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Login request */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Refresh token request */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** Change password request */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Forgot password request */
export interface ForgotPasswordRequest {
  email: string;
}

/** Reset password request */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/** Verify email request */
export interface VerifyEmailRequest {
  token: string;
}

/** JWT access token payload (minimal — no sensitive data) */
export interface JwtPayload {
  sub: UUID;      // userId
  jti?: string;   // optional token ID
  type: 'access';
  iat?: number;
  exp?: number;
}
