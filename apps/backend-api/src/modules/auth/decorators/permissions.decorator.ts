import { SetMetadata } from '@nestjs/common';
import type { PermissionName } from '@ai-mos/constants';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Require one or more permissions on a route.
 * Usage: @Permissions('user.read', 'profile.write')
 */
export const Permissions = (...permissions: PermissionName[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
