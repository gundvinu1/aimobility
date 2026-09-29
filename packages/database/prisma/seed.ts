/**
 * AI-MOS Database Seed — Module 2: Authentication + RBAC
 *
 * Seeds:
 *   - Platform roles (SUPER_ADMIN, OWNER, ADMIN, MANAGER, DISPATCHER, ACCOUNTANT, DRIVER, CUSTOMER)
 *   - Module 2 permissions (user.*, profile.*, role.*, permission.*)
 *   - Role-permission assignments
 *   - Test users — one per role (for development/testing only)
 *
 * Safe to run multiple times (idempotent via upsert).
 *
 * ─── TEST LOGIN CREDENTIALS ────────────────────────────────
 *
 *  Role          Email                          Password
 *  ──────────    ─────────────────────────────  ─────────────
 *  SUPER_ADMIN   superadmin@aimos.dev           Admin@12345!
 *  OWNER         owner@aimos.dev                Admin@12345!
 *  ADMIN         admin@aimos.dev                Admin@12345!
 *  MANAGER       manager@aimos.dev              Admin@12345!
 *  DISPATCHER    dispatcher@aimos.dev           Admin@12345!
 *  ACCOUNTANT    accountant@aimos.dev           Admin@12345!
 *  DRIVER        driver@aimos.dev               Admin@12345!
 *  CUSTOMER      customer@aimos.dev             Admin@12345!
 *
 * ───────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ─── Test password (same for all dev users) ──────────────────────────────────
const TEST_PASSWORD = 'Admin@12345!';

const ROLES = [
  { name: 'SUPER_ADMIN', description: 'Full platform access — internal use only' },
  { name: 'OWNER',       description: 'Company owner with full tenant access' },
  { name: 'ADMIN',       description: 'Tenant administrator' },
  { name: 'MANAGER',     description: 'Operational manager' },
  { name: 'DISPATCHER',  description: 'Handles dispatch and trip assignments' },
  { name: 'ACCOUNTANT',  description: 'Access to billing and financial reports' },
  { name: 'DRIVER',      description: 'Driver with limited access to driver app data' },
  { name: 'CUSTOMER',    description: 'End customer with access to their own bookings' },
] as const;

const PERMISSIONS = [
  { name: 'user.read',        description: 'Read user records' },
  { name: 'user.write',       description: 'Create and update users' },
  { name: 'user.delete',      description: 'Soft-delete users' },
  { name: 'profile.read',     description: 'Read own profile' },
  { name: 'profile.write',    description: 'Update own profile' },
  { name: 'role.read',        description: 'Read roles' },
  { name: 'role.write',       description: 'Create and update roles' },
  { name: 'permission.read',  description: 'Read permissions' },
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
    'role.read', 'permission.read',
  ],
  ADMIN: [
    'user.read', 'user.write',
    'profile.read', 'profile.write',
    'role.read', 'permission.read',
  ],
  MANAGER:    ['user.read', 'profile.read', 'profile.write'],
  DISPATCHER: ['user.read', 'profile.read', 'profile.write'],
  ACCOUNTANT: ['user.read', 'profile.read', 'profile.write'],
  DRIVER:     ['profile.read', 'profile.write'],
  CUSTOMER:   ['profile.read', 'profile.write'],
};

/** Test users — one per role */
const TEST_USERS = [
  { email: 'superadmin@aimos.dev', firstName: 'Super',      lastName: 'Admin',      role: 'SUPER_ADMIN' },
  { email: 'owner@aimos.dev',      firstName: 'Company',    lastName: 'Owner',      role: 'OWNER'       },
  { email: 'admin@aimos.dev',      firstName: 'Tenant',     lastName: 'Admin',      role: 'ADMIN'       },
  { email: 'manager@aimos.dev',    firstName: 'Operations', lastName: 'Manager',    role: 'MANAGER'     },
  { email: 'dispatcher@aimos.dev', firstName: 'Fleet',      lastName: 'Dispatcher', role: 'DISPATCHER'  },
  { email: 'accountant@aimos.dev', firstName: 'Finance',    lastName: 'Accountant', role: 'ACCOUNTANT'  },
  { email: 'driver@aimos.dev',     firstName: 'Test',       lastName: 'Driver',     role: 'DRIVER'      },
  { email: 'customer@aimos.dev',   firstName: 'Test',       lastName: 'Customer',   role: 'CUSTOMER'    },
] as const;

async function main() {
  console.log('🌱 Starting AI-MOS seed...\n');

  // ── 1. Roles ──────────────────────────────────────────────────────────────
  console.log('📋 Seeding roles...');
  const roleMap: Record<string, string> = {};
  for (const role of ROLES) {
    const r = await prisma.role.upsert({
      where:  { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
    roleMap[role.name] = r.id;
    console.log(`  ✅ ${role.name}`);
  }

  // ── 2. Permissions ────────────────────────────────────────────────────────
  console.log('\n🔑 Seeding permissions...');
  const permMap: Record<string, string> = {};
  for (const perm of PERMISSIONS) {
    const p = await prisma.permission.upsert({
      where:  { name: perm.name },
      update: { description: perm.description },
      create: { name: perm.name, description: perm.description },
    });
    permMap[perm.name] = p.id;
    console.log(`  ✅ ${perm.name}`);
  }

  // ── 3. Role ↔ Permission assignments ─────────────────────────────────────
  console.log('\n🔗 Assigning permissions to roles...');
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;
    for (const permName of permNames) {
      const permId = permMap[permName];
      if (!permId) continue;
      await prisma.rolePermission.upsert({
        where:  { roleId_permissionId: { roleId, permissionId: permId } },
        update: {},
        create: { roleId, permissionId: permId },
      });
    }
    console.log(`  ✅ ${roleName.padEnd(12)} → [${permNames.join(', ')}]`);
  }

  // ── 4. Test users ─────────────────────────────────────────────────────────
  console.log('\n👤 Seeding test users...');
  const passwordHash = await argon2.hash(TEST_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  for (const u of TEST_USERS) {
    const roleId = roleMap[u.role];
    if (!roleId) continue;

    // Upsert user
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: { firstName: u.firstName, lastName: u.lastName, passwordHash },
      create: {
        email:         u.email,
        passwordHash,
        firstName:     u.firstName,
        lastName:      u.lastName,
        status:        'ACTIVE',
        emailVerified: true,
      },
    });

    // Ensure the role is assigned (remove old roles first, then assign)
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId } });

    console.log(`  ✅ ${u.role.padEnd(12)} → ${u.email}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(62));
  console.log('✅ Seed complete!\n');
  console.log('  TEST LOGIN CREDENTIALS (all use password: Admin@12345!)');
  console.log('  ' + '─'.repeat(58));
  for (const u of TEST_USERS) {
    console.log(`  ${u.role.padEnd(14)}  ${u.email}`);
  }
  console.log('  ' + '─'.repeat(58));
  console.log('\n  API:       http://localhost:4000/api/v1/auth/login');
  console.log('  Dashboard: http://localhost:3000/login\n');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
