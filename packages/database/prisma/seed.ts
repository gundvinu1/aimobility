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

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Load .env if not already set
if (!process.env.DATABASE_URL) {
  const envPaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
        }
      }
    }
  }
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public';
}

const prisma = new PrismaClient();

import { scryptSync } from 'crypto';

function hashPassword(password: string): string {
  const salt = 'a1b2c3d4e5f60718';
  const derivedKey = scryptSync(password, salt, 64);
  return `$scrypt$${salt}$${derivedKey.toString('hex')}`;
}

const SEED_PASSWORD_HASH = hashPassword('Admin@12345!');

const ROLES = [
  { name: 'SUPER_ADMIN', description: 'Full platform access — internal use only', scope: 'PLATFORM', level: 100, isSystem: true },
  { name: 'OWNER',       description: 'Company owner with full tenant access',    scope: 'COMPANY',  level: 80,  isSystem: true },
  { name: 'ADMIN',       description: 'Tenant administrator',                     scope: 'COMPANY',  level: 60,  isSystem: true },
  { name: 'MANAGER',     description: 'Operational manager',                      scope: 'COMPANY',  level: 40,  isSystem: true },
  { name: 'DISPATCHER',  description: 'Handles dispatch and trip assignments',    scope: 'COMPANY',  level: 30,  isSystem: true },
  { name: 'ACCOUNTANT',  description: 'Access to billing and financial reports',  scope: 'COMPANY',  level: 30,  isSystem: true },
  { name: 'DRIVER',      description: 'Driver with access to driver tasks/trips', scope: 'COMPANY',  level: 20,  isSystem: true },
  { name: 'CUSTOMER',    description: 'End customer with access to bookings',     scope: 'COMPANY',  level: 10,  isSystem: true },
] as const;

const PERMISSIONS = [
  // Module 2 — Auth/User management
  { name: 'user.read',                 description: 'Read user records',                     module: 'AUTH',     action: 'READ' },
  { name: 'user.write',                description: 'Create and update users',               module: 'AUTH',     action: 'UPDATE' },
  { name: 'user.delete',               description: 'Soft-delete users',                     module: 'AUTH',     action: 'DELETE' },
  { name: 'profile.read',              description: 'Read own profile',                      module: 'AUTH',     action: 'READ' },
  { name: 'profile.write',             description: 'Update own profile',                    module: 'AUTH',     action: 'UPDATE' },

  // Module 8B — RBAC management
  { name: 'role.read',                 description: 'View roles and hierarchy',              module: 'RBAC',     action: 'READ' },
  { name: 'role.write',                description: 'Create and update roles',               module: 'RBAC',     action: 'UPDATE' },
  { name: 'role.create',               description: 'Create custom roles',                   module: 'RBAC',     action: 'CREATE' },
  { name: 'role.update',               description: 'Update custom roles',                   module: 'RBAC',     action: 'UPDATE' },
  { name: 'role.delete',               description: 'Delete custom roles',                   module: 'RBAC',     action: 'DELETE' },
  { name: 'permission.read',           description: 'View permissions and matrix',           module: 'RBAC',     action: 'READ' },
  { name: 'permission.write',          description: 'Manage permissions',                    module: 'RBAC',     action: 'UPDATE' },
  { name: 'permission.assign',         description: 'Assign/toggle role permissions',        module: 'RBAC',     action: 'ASSIGN' },

  // Module 3 — Company management
  { name: 'company.read',              description: 'Read company records',                  module: 'COMPANY',  action: 'READ' },
  { name: 'company.create',            description: 'Create a company',                      module: 'COMPANY',  action: 'CREATE' },
  { name: 'company.update',            description: 'Update company profile',                module: 'COMPANY',  action: 'UPDATE' },
  { name: 'company.delete',            description: 'Deactivate a company',                  module: 'COMPANY',  action: 'DELETE' },
  { name: 'company.settings.read',     description: 'Read company settings',                 module: 'COMPANY',  action: 'READ' },
  { name: 'company.settings.write',    description: 'Update company settings',                module: 'COMPANY',  action: 'UPDATE' },
  { name: 'company.members.read',      description: 'Read company members',                  module: 'COMPANY',  action: 'READ' },
  { name: 'company.members.write',     description: 'Manage company members',                module: 'COMPANY',  action: 'UPDATE' },
  { name: 'company.invite',            description: 'Invite users to a company',             module: 'COMPANY',  action: 'CREATE' },

  // Module 4 — Employee management
  { name: 'employee.read',             description: 'Read employee directory and details',   module: 'EMPLOYEE', action: 'READ' },
  { name: 'employee.create',           description: 'Create employee records',               module: 'EMPLOYEE', action: 'CREATE' },
  { name: 'employee.update',           description: 'Update employee records',               module: 'EMPLOYEE', action: 'UPDATE' },
  { name: 'employee.delete',           description: 'Soft-delete employee records',          module: 'EMPLOYEE', action: 'DELETE' },
  { name: 'employee.status.write',     description: 'Update employee employment status',     module: 'EMPLOYEE', action: 'UPDATE' },
  { name: 'employee.user.link',        description: 'Link/unlink user account to employee',   module: 'EMPLOYEE', action: 'UPDATE' },

  // Module 5 — Vehicle management
  { name: 'vehicle.read',              description: 'Read vehicle directory and details',    module: 'VEHICLE',  action: 'READ' },
  { name: 'vehicle.create',            description: 'Create vehicle records',                module: 'VEHICLE',  action: 'CREATE' },
  { name: 'vehicle.update',            description: 'Update vehicle records',                module: 'VEHICLE',  action: 'UPDATE' },
  { name: 'vehicle.delete',            description: 'Delete vehicle records',                module: 'VEHICLE',  action: 'DELETE' },
  { name: 'vehicle.status.write',      description: 'Update vehicle operational status',     module: 'VEHICLE',  action: 'UPDATE' },
  { name: 'vehicle.document.manage',   description: 'Manage vehicle compliance documents',   module: 'VEHICLE',  action: 'MANAGE' },
  { name: 'vehicle.maintenance.manage',description: 'Manage vehicle maintenance records',    module: 'VEHICLE',  action: 'MANAGE' },

  // Module 6 — Driver management
  { name: 'driver.read',               description: 'Read driver profiles',                  module: 'DRIVER',   action: 'READ' },
  { name: 'driver.create',             description: 'Create driver records',                 module: 'DRIVER',   action: 'CREATE' },
  { name: 'driver.update',             description: 'Update driver records',                 module: 'DRIVER',   action: 'UPDATE' },
  { name: 'driver.delete',             description: 'Delete driver records',                 module: 'DRIVER',   action: 'DELETE' },
  { name: 'driver.status.update',      description: 'Update driver operational status',      module: 'DRIVER',   action: 'UPDATE' },
  { name: 'driver.duty.update',        description: 'Toggle driver on/off duty status',      module: 'DRIVER',   action: 'UPDATE' },
  { name: 'driver.documents.read',     description: 'Read driver documents',                 module: 'DRIVER',   action: 'READ' },
  { name: 'driver.documents.write',    description: 'Manage driver documents',                module: 'DRIVER',   action: 'UPDATE' },
  { name: 'driver.vehicle.assign',     description: 'Assign or unassign vehicle to driver',  module: 'DRIVER',   action: 'UPDATE' },

  // Module 7 — Booking management
  { name: 'booking.read',              description: 'Read booking requests',                 module: 'BOOKING',  action: 'READ' },
  { name: 'booking.create',            description: 'Create booking requests',               module: 'BOOKING',  action: 'CREATE' },
  { name: 'booking.update',            description: 'Update booking details',                module: 'BOOKING',  action: 'UPDATE' },
  { name: 'booking.delete',            description: 'Delete booking requests',               module: 'BOOKING',  action: 'DELETE' },
  { name: 'booking.confirm',           description: 'Confirm booking requests',              module: 'BOOKING',  action: 'UPDATE' },
  { name: 'booking.cancel',            description: 'Cancel booking requests',               module: 'BOOKING',  action: 'UPDATE' },

  // Module 7 — Trip & Dispatch management
  { name: 'trip.read',                 description: 'Read trips',                            module: 'TRIP',     action: 'READ' },
  { name: 'trip.create',               description: 'Create trips',                          module: 'TRIP',     action: 'CREATE' },
  { name: 'trip.update',               description: 'Update trips',                          module: 'TRIP',     action: 'UPDATE' },
  { name: 'trip.delete',               description: 'Delete trips',                          module: 'TRIP',     action: 'DELETE' },
  { name: 'trip.assign.driver',        description: 'Assign driver to trip',                 module: 'TRIP',     action: 'UPDATE' },
  { name: 'trip.assign.vehicle',       description: 'Assign vehicle to trip',                module: 'TRIP',     action: 'UPDATE' },
  { name: 'trip.dispatch',             description: 'Dispatch trips to drivers',             module: 'TRIP',     action: 'DISPATCH' },
  { name: 'trip.status.update',        description: 'Update trip operational status',        module: 'TRIP',     action: 'UPDATE' },
  { name: 'trip.cancel',               description: 'Cancel trips',                          module: 'TRIP',     action: 'UPDATE' },
] as const;

/** Role → permissions mapping */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    'user.read', 'user.write', 'user.delete',
    'profile.read', 'profile.write',
    'role.read', 'role.write', 'role.create', 'role.update', 'role.delete',
    'permission.read', 'permission.write', 'permission.assign',
    // Module 3
    'company.read', 'company.create', 'company.update', 'company.delete',
    'company.settings.read', 'company.settings.write',
    'company.members.read', 'company.members.write', 'company.invite',
    // Module 4
    'employee.read', 'employee.create', 'employee.update', 'employee.delete',
    'employee.status.write', 'employee.user.link',
    // Module 5
    'vehicle.read', 'vehicle.create', 'vehicle.update', 'vehicle.delete',
    'vehicle.status.write', 'vehicle.document.manage', 'vehicle.maintenance.manage',
    // Module 6
    'driver.read', 'driver.create', 'driver.update', 'driver.delete',
    'driver.status.update', 'driver.duty.update', 'driver.documents.read',
    'driver.documents.write', 'driver.vehicle.assign',
    // Module 7
    'booking.read', 'booking.create', 'booking.update', 'booking.delete',
    'booking.confirm', 'booking.cancel',
    'trip.read', 'trip.create', 'trip.update', 'trip.delete',
    'trip.assign.driver', 'trip.assign.vehicle', 'trip.dispatch',
    'trip.status.update', 'trip.cancel',
  ],
  OWNER: [
    'user.read', 'user.write',
    'profile.read', 'profile.write',
    'role.read', 'role.write', 'role.create', 'role.update', 'role.delete',
    'permission.read', 'permission.write', 'permission.assign',
    // Module 3
    'company.read', 'company.create', 'company.update', 'company.delete',
    'company.settings.read', 'company.settings.write',
    'company.members.read', 'company.members.write', 'company.invite',
    // Module 4
    'employee.read', 'employee.create', 'employee.update', 'employee.delete',
    'employee.status.write', 'employee.user.link',
    // Module 5
    'vehicle.read', 'vehicle.create', 'vehicle.update', 'vehicle.delete',
    'vehicle.status.write', 'vehicle.document.manage', 'vehicle.maintenance.manage',
    // Module 6
    'driver.read', 'driver.create', 'driver.update', 'driver.delete',
    'driver.status.update', 'driver.duty.update', 'driver.documents.read',
    'driver.documents.write', 'driver.vehicle.assign',
    // Module 7
    'booking.read', 'booking.create', 'booking.update', 'booking.delete',
    'booking.confirm', 'booking.cancel',
    'trip.read', 'trip.create', 'trip.update', 'trip.delete',
    'trip.assign.driver', 'trip.assign.vehicle', 'trip.dispatch',
    'trip.status.update', 'trip.cancel',
  ],
  ADMIN: [
    'user.read', 'user.write',
    'profile.read', 'profile.write',
    'role.read', 'permission.read',
    // Module 3
    'company.read', 'company.update',
    'company.settings.read', 'company.settings.write',
    'company.members.read', 'company.members.write', 'company.invite',
    // Module 4
    'employee.read', 'employee.create', 'employee.update', 'employee.delete',
    'employee.status.write', 'employee.user.link',
    // Module 5
    'vehicle.read', 'vehicle.create', 'vehicle.update', 'vehicle.delete',
    'vehicle.status.write', 'vehicle.document.manage', 'vehicle.maintenance.manage',
    // Module 6
    'driver.read', 'driver.create', 'driver.update', 'driver.delete',
    'driver.status.update', 'driver.duty.update', 'driver.documents.read',
    'driver.documents.write', 'driver.vehicle.assign',
    // Module 7
    'booking.read', 'booking.create', 'booking.update', 'booking.delete',
    'booking.confirm', 'booking.cancel',
    'trip.read', 'trip.create', 'trip.update', 'trip.delete',
    'trip.assign.driver', 'trip.assign.vehicle', 'trip.dispatch',
    'trip.status.update', 'trip.cancel',
  ],
  MANAGER: [
    'user.read', 'profile.read', 'profile.write', 'company.read', 'company.members.read',
    'employee.read', 'employee.create', 'employee.update', 'employee.status.write',
    'vehicle.read', 'vehicle.create', 'vehicle.update', 'vehicle.status.write',
    'vehicle.document.manage', 'vehicle.maintenance.manage',
    'driver.read', 'driver.create', 'driver.update', 'driver.status.update',
    'driver.duty.update', 'driver.documents.read', 'driver.documents.write', 'driver.vehicle.assign',
    'booking.read', 'booking.create', 'booking.update', 'booking.confirm', 'booking.cancel',
    'trip.read', 'trip.create', 'trip.update', 'trip.assign.driver', 'trip.assign.vehicle',
    'trip.dispatch', 'trip.status.update', 'trip.cancel',
  ],
  DISPATCHER: [
    'company.read', 'profile.read', 'profile.write',
    'vehicle.read', 'driver.read', 'driver.duty.update', 'driver.vehicle.assign',
    'booking.read', 'booking.create', 'booking.update', 'booking.confirm', 'booking.cancel',
    'trip.read', 'trip.create', 'trip.update', 'trip.assign.driver', 'trip.assign.vehicle',
    'trip.dispatch', 'trip.status.update', 'trip.cancel',
  ],
  ACCOUNTANT: [
    'company.read', 'profile.read', 'profile.write',
    'booking.read', 'trip.read',
  ],
  DRIVER: [
    'profile.read', 'profile.write',
    'trip.read', 'trip.status.update', 'driver.duty.update', 'vehicle.read',
  ],
  CUSTOMER: [
    'profile.read', 'profile.write',
    'booking.read', 'booking.create', 'booking.cancel', 'trip.read',
  ],
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
      update: {
        description: role.description,
        scope: role.scope,
        level: role.level,
        isSystem: role.isSystem,
      },
      create: {
        name: role.name,
        description: role.description,
        scope: role.scope,
        level: role.level,
        isSystem: role.isSystem,
      },
    });
    roleMap[role.name] = r.id;
    console.log(`  ✅ ${role.name.padEnd(12)} [${role.scope} - Level ${role.level}]`);
  }

  // ── 2. Permissions ────────────────────────────────────────────────────────
  console.log('\n🔑 Seeding permissions...');
  const permMap: Record<string, string> = {};
  for (const perm of PERMISSIONS) {
    const p = await prisma.permission.upsert({
      where:  { name: perm.name },
      update: {
        description: perm.description,
        module: perm.module,
        action: perm.action,
      },
      create: {
        name: perm.name,
        description: perm.description,
        module: perm.module,
        action: perm.action,
      },
    });
    permMap[perm.name] = p.id;
    console.log(`  ✅ ${perm.name}`);
  }

  // ── 3. Role ↔ Permission assignments ─────────────────────────────────────
  console.log('\n🔗 Assigning permissions to roles...');
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;
    const targetPermIds = permNames.map((p) => permMap[p]).filter((id): id is string => !!id);
    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: { notIn: targetPermIds },
      },
    });
    for (const permId of targetPermIds) {
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

  for (const u of TEST_USERS) {
    const roleId = roleMap[u.role];
    if (!roleId) continue;

    // Upsert user — update password hash so Admin@12345! always works
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: { firstName: u.firstName, lastName: u.lastName, passwordHash: SEED_PASSWORD_HASH },
      create: {
        email:         u.email,
        passwordHash:  SEED_PASSWORD_HASH,
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
