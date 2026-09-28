import type { JwtPayload } from '@ai-mos/types';

/** Authenticated user attached to request after JWT validation */
export interface AuthUser {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/** JWT payload stored in access token */
export type AccessTokenPayload = JwtPayload;

/** Metadata for JWT verify result */
export interface TokenVerifyResult {
  userId: string;
  jti?: string;
}
