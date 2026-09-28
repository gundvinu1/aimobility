/**
 * AI-MOS Database Seed — Module 2: Authentication + RBAC
 *
 * Seeds:
 *   - Platform roles (SUPER_ADMIN, OWNER, ADMIN, MANAGER, DISPATCHER, ACCOUNTANT, DRIVER, CUSTOMER)
 *   - Module 2 permissions (user.*, profile.*, role.*, permission.*)
 *   - Role-permission assignments
 *
 * Safe to run multiple times (idempotent via upsert).
 * Does NOT create real users or business data.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES = [
  { name: 'SUPER_ADMIN', description: 'Full platform access — internal use only' },
  { name: 'OWNER', description: 'Company owner with full tenant access' },
  { name: 'ADMIN', description: 'Tenant administrator' },
  { name: 'MANAGER', description: 'Operational manager' },
  { name: 'DISPATCHER', description: 'Handles dispatch and trip assignments' },
  { name: 'ACCOUNTANT', description: 'Access to billing and financial reports' },
  { name: 'DRIVER', description: 'Driver with limited access to driver app data' },
  { name: 'CUSTOMER', description: 'End customer with access to their own bookings' },
] as const;

const PERMISSIONS = [
  { name: 'user.read', description: 'Read user records' },
  { name: 'user.write', description: 'Create and update users' },
  { name: 'user.delete', description: 'Soft-delete users' },
  { name: 'profile.read', description: 'Read own profile' },
  { name: 'profile.write', description: 'Update own profile' },
  { name: 'role.read', description: 'Read roles' },
  { name: 'role.write', description: 'Create and update roles' },
  { name: 'permission.read', description: 'Read permissions' },
  { name: 'permission.write', description: 'Create and update permissions' },
] as const;

/** Role → permissions mapping */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    'user.read', 'user.write', 'user.delete',
    'profile.read', 'profile.write',
    'role.read', 'role.write',
    'permission.read', 'permission.write',
  ],
  OWNER: [
    'user.read', 'user.write',
    'profile.read', 'profile.write',
    'role.read',
    'permission.read',
  ],
  ADMIN: [
    'user.read', 'user.write',
    'profile.read', 'profile.write',
    'role.read',
    'permission.read',
  ],
  MANAGER: ['user.read', 'profile.read', 'profile.write'],
  DISPATCHER: ['user.read', 'profile.read', 'profile.write'],
  ACCOUNTANT: ['user.read', 'profile.read', 'profile.write'],
  DRIVER: ['profile.read', 'profile.write'],
  CUSTOMER: ['profile.read', 'profile.write'],
};

async function main() {
  console.log('🌱 Starting Module 2 seed...');

  // Upsert roles
  const roleMap: Record<string, string> = {};
  for (const role of ROLES) {
    const r = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
    roleMap[role.name] = r.id;
    console.log(`  ✅ Role: ${role.name}`);
  }

  // Upsert permissions
  const permMap: Record<string, string> = {};
  for (const perm of PERMISSIONS) {
    const p = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: { name: perm.name, description: perm.description },
    });
    permMap[perm.name] = p.id;
    console.log(`  ✅ Permission: ${perm.name}`);
  }

  // Assign permissions to roles
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;
    for (const permName of permNames) {
      const permId = permMap[permName];
      if (!permId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permId } },
        update: {},
        create: { roleId, permissionId: permId },
      });
    }
    console.log(`  🔗 ${roleName} → ${permNames.length} permissions`);
  }

  console.log('');
  console.log('✅ Module 2 seed complete.');
  console.log(`   Roles:       ${ROLES.length}`);
  console.log(`   Permissions: ${PERMISSIONS.length}`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
