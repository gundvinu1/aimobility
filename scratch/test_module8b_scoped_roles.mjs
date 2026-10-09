// =============================================================================
// Module 8B Comprehensive Automated Verification Script
// =============================================================================

const BASE_URL = 'http://localhost:4000/api/v1';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
    results.push({ message, status: 'PASS' });
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
    results.push({ message, status: 'FAIL' });
  }
}

async function login(email, password = 'Admin@12345!') {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status}`);
  }
  const json = await res.json();
  const data = json.data ?? json;
  return {
    accessToken: data.tokens.accessToken,
    user: data.user,
  };
}

async function request(path, options = {}) {
  const { token, companyId, method = 'GET', body } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(companyId ? { 'x-company-id': companyId } : {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return {
    status: res.status,
    ok: res.ok,
    data: data?.data ?? data,
    raw: data,
  };
}

async function run() {
  console.log('\n🚀 Starting Module 8B Comprehensive Verification Suite...\n');

  // 1. Authenticate users
  console.log('1. Authenticating test users...');
  const sa = await login('superadmin@aimos.dev');
  const owner = await login('owner@aimos.dev');
  const admin = await login('admin@aimos.dev');
  const manager = await login('manager@aimos.dev');
  const dispatcher = await login('dispatcher@aimos.dev');
  const accountant = await login('accountant@aimos.dev');
  const driver = await login('driver@aimos.dev');
  const customer = await login('customer@aimos.dev');

  assert(Boolean(sa.accessToken), 'SUPER_ADMIN authenticated successfully');
  assert(Boolean(owner.accessToken), 'OWNER authenticated successfully');
  assert(Boolean(admin.accessToken), 'ADMIN authenticated successfully');

  // Retrieve available companies for multi-tenant isolation testing
  let compRes = await request('/companies', { token: owner.accessToken });
  let companies = compRes.data?.items ?? compRes.data ?? [];
  if (companies.length < 2) {
    // If fewer than 2 companies, create Company B
    const createB = await request('/companies', {
      token: owner.accessToken,
      method: 'POST',
      body: {
        name: 'Nexus Mobility Corp',
        slug: `nexus-mobility-${Date.now()}`,
      },
    });
    compRes = await request('/companies', { token: owner.accessToken });
    companies = compRes.data?.items ?? compRes.data ?? [];
  }
  assert(companies.length >= 2, `At least 2 companies exist for multi-tenant isolation testing (found ${companies.length})`);
  const companyA = companies[0];
  const companyB = companies[1];
  console.log(`   Tenant A: ${companyA.name} (${companyA.id})`);
  console.log(`   Tenant B: ${companyB.name} (${companyB.id})`);

  // 2. Endpoints Verification
  console.log('\n2. Testing Endpoints (/roles, /permissions, aliases)...');
  const rolesV1 = await request('/roles', { token: sa.accessToken });
  assert(rolesV1.status === 200 && Array.isArray(rolesV1.data), 'GET /api/v1/roles returns 200 with array');

  const rolesRbac = await request('/rbac/roles', { token: sa.accessToken });
  assert(rolesRbac.status === 200 && Array.isArray(rolesRbac.data), 'GET /api/v1/rbac/roles backwards compatibility returns 200');

  const permsV1 = await request('/permissions', { token: sa.accessToken });
  assert(permsV1.status === 200 && Array.isArray(permsV1.data) && permsV1.data.length >= 50, 'GET /api/v1/permissions returns all permissions catalog');

  const permsRbac = await request('/rbac/permissions', { token: sa.accessToken });
  assert(permsRbac.status === 200, 'GET /api/v1/rbac/permissions backwards compatibility returns 200');

  // Test GET /permissions/:id by name and UUID
  const firstPerm = permsV1.data[0];
  const permByName = await request(`/permissions/${firstPerm.name}`, { token: sa.accessToken });
  assert(permByName.status === 200 && permByName.data.name === firstPerm.name, `GET /api/v1/permissions/:name (${firstPerm.name}) returns permission details`);

  const permById = await request(`/permissions/${firstPerm.id}`, { token: sa.accessToken });
  assert(permById.status === 200 && permById.data.id === firstPerm.id, `GET /api/v1/permissions/:id (${firstPerm.id}) returns permission details`);

  // 3. Role Details with Assigned Users & Permissions
  console.log('\n3. Testing Role Details with Assigned Users & Permissions...');
  const ownerRole = rolesV1.data.find((r) => r.name === 'OWNER');
  assert(Boolean(ownerRole), 'System role OWNER found in role catalog');

  const ownerRoleDetail = await request(`/roles/${ownerRole.id}`, {
    token: owner.accessToken,
    companyId: companyA.id,
  });
  assert(ownerRoleDetail.status === 200, 'GET /api/v1/roles/:id for OWNER returns 200');
  assert(Array.isArray(ownerRoleDetail.data.permissions), 'Role details include permissions array');
  assert(Array.isArray(ownerRoleDetail.data.users), 'Role details include assigned users array');
  assert(ownerRoleDetail.data.users.length > 0, `Role details returned ${ownerRoleDetail.data.users.length} assigned member(s)`);
  assert(Boolean(ownerRoleDetail.data.users[0].email), `Assigned member has email: ${ownerRoleDetail.data.users[0]?.email}`);

  // Test GET /roles/:id/permissions
  const ownerPerms = await request(`/roles/${ownerRole.id}/permissions`, {
    token: owner.accessToken,
    companyId: companyA.id,
  });
  assert(ownerPerms.status === 200 && Array.isArray(ownerPerms.data), 'GET /api/v1/roles/:id/permissions returns permissions list');

  // 4. Multi-Tenant Custom Role Isolation Test
  console.log('\n4. Testing Multi-Tenant Custom Role Isolation...');
  const customRoleName = 'Fleet Supervisor';

  // Company A creates "Fleet Supervisor"
  const compACreate = await request('/roles', {
    token: sa.accessToken, // or owner of company A
    companyId: companyA.id,
    method: 'POST',
    body: {
      name: customRoleName,
      description: 'Fleet Supervisor for Company A',
      level: 35,
      permissionIds: ['vehicle.read', 'driver.read'],
      companyId: companyA.id,
    },
  });
  assert(compACreate.status === 201, `Company A successfully created custom role "${customRoleName}"`);
  const compARoleId = compACreate.data.id;

  // Company B creates "Fleet Supervisor" with same name
  const compBCreate = await request('/roles', {
    token: sa.accessToken,
    companyId: companyB.id,
    method: 'POST',
    body: {
      name: customRoleName,
      description: 'Fleet Supervisor for Company B',
      level: 35,
      permissionIds: ['employee.read', 'vehicle.read'],
      companyId: companyB.id,
    },
  });
  assert(compBCreate.status === 201, `Company B successfully created custom role with SAME name "${customRoleName}"`);
  const compBRoleId = compBCreate.data.id;
  assert(compARoleId !== compBRoleId, 'Both roles have unique IDs across tenants');

  // Company A lists roles with company context
  const compARoles = await request('/roles', {
    token: owner.accessToken,
    companyId: companyA.id,
  });
  const compAHasARole = compARoles.data.some((r) => r.id === compARoleId);
  const compAHasBRole = compARoles.data.some((r) => r.id === compBRoleId);
  assert(compAHasARole === true, 'Company A can view its own custom role');
  assert(compAHasBRole === false, 'Company A CANNOT view Company B custom role');

  // Cross-tenant access rejection tests
  const crossGet = await request(`/roles/${compBRoleId}`, {
    token: owner.accessToken,
    companyId: companyA.id,
  });
  assert(crossGet.status === 403, 'Company A GET Company B role is REJECTED with 403 Forbidden');

  const crossPatch = await request(`/roles/${compBRoleId}`, {
    token: owner.accessToken,
    companyId: companyA.id,
    method: 'PATCH',
    body: { description: 'Malicious modification' },
  });
  assert(crossPatch.status === 403, 'Company A PATCH Company B role is REJECTED with 403 Forbidden');

  const crossPutPerms = await request(`/roles/${compBRoleId}/permissions`, {
    token: owner.accessToken,
    companyId: companyA.id,
    method: 'PUT',
    body: { permissionIds: ['vehicle.read'] },
  });
  assert(crossPutPerms.status === 403, 'Company A PUT Company B role permissions is REJECTED with 403 Forbidden');

  const crossDelete = await request(`/roles/${compBRoleId}`, {
    token: owner.accessToken,
    companyId: companyA.id,
    method: 'DELETE',
  });
  assert(crossDelete.status === 403, 'Company A DELETE Company B role is REJECTED with 403 Forbidden');

  // 5. System Role Protection & Privilege Escalation Prevention
  console.log('\n5. Testing Security Rules & Privilege Escalation Prevention...');

  // System role deletion prevention
  const delSys = await request(`/roles/${ownerRole.id}`, {
    token: sa.accessToken,
    method: 'DELETE',
  });
  assert(delSys.status === 400, 'Attempt to DELETE system role OWNER is rejected with 400 Bad Request');

  // System role rename prevention
  const renameSys = await request(`/roles/${ownerRole.id}`, {
    token: sa.accessToken,
    method: 'PATCH',
    body: { name: 'RENAMED_OWNER' },
  });
  assert(renameSys.status === 400, 'Attempt to rename system role OWNER is rejected with 400 Bad Request');

  // Reserved system role name collision prevention
  const collideSys = await request('/roles', {
    token: sa.accessToken,
    companyId: companyA.id,
    method: 'POST',
    body: { name: 'SUPER_ADMIN', level: 30 },
  });
  assert(collideSys.status === 409, 'Attempt to create custom role with reserved system name SUPER_ADMIN is rejected with 409 Conflict');

  // Duplicate role in same tenant rejection
  const dupTenant = await request('/roles', {
    token: sa.accessToken,
    companyId: companyA.id,
    method: 'POST',
    body: { name: customRoleName, level: 30, companyId: companyA.id },
  });
  assert(dupTenant.status === 409, 'Attempt to create duplicate role name within same company is rejected with 409 Conflict');

  // Self-elevation prevention: user cannot modify permissions of their own active role
  const selfElevate = await request(`/roles/${ownerRole.id}/permissions`, {
    token: owner.accessToken,
    companyId: companyA.id,
    method: 'PUT',
    body: { permissionIds: ['role.read'] },
  });
  assert(selfElevate.status === 403, 'Self-elevation attempt to modify own assigned role permissions is rejected with 403 Forbidden');

  // Hierarchy level protection: level >= caller level
  const ownerEscalate = await request('/roles', {
    token: owner.accessToken,
    companyId: companyA.id,
    method: 'POST',
    body: { name: 'SUPER_OWNER', level: 90 }, // OWNER is 80
  });
  assert(ownerEscalate.status === 403, 'Privilege escalation: creating role with level >= caller level is rejected with 403 Forbidden');

  // 6. Role Permissions Update & Audit Logging
  console.log('\n6. Testing Role Permission Updates & Audit Logging...');
  const updatePerms = await request(`/roles/${compARoleId}/permissions`, {
    token: sa.accessToken,
    companyId: companyA.id,
    method: 'PUT',
    body: { permissionIds: ['vehicle.read', 'vehicle.create', 'driver.read'] },
  });
  assert(updatePerms.status === 200, 'Updated Company A custom role permissions successfully');
  assert(updatePerms.data.permissions.length === 3, 'Role now has 3 assigned permissions');

  // Test PATCH alias for updating permissions
  const patchPerms = await request(`/roles/${compARoleId}/permissions`, {
    token: sa.accessToken,
    companyId: companyA.id,
    method: 'PATCH',
    body: { permissionIds: ['vehicle.read'] },
  });
  assert(patchPerms.status === 200 && patchPerms.data.permissions.length === 1, 'PATCH /roles/:id/permissions alias works and updates permissions');

  // 7. Role Update & Deletion
  console.log('\n7. Testing Custom Role Update & Deletion...');
  const patchDesc = await request(`/roles/${compARoleId}`, {
    token: sa.accessToken,
    companyId: companyA.id,
    method: 'PATCH',
    body: { description: 'Updated Fleet Supervisor description' },
  });
  assert(patchDesc.status === 200 && patchDesc.data.description === 'Updated Fleet Supervisor description', 'Custom role description updated');

  const delRoleA = await request(`/roles/${compARoleId}`, {
    token: sa.accessToken,
    companyId: companyA.id,
    method: 'DELETE',
  });
  assert(delRoleA.status === 200, 'Company A custom role deleted successfully');

  const delRoleB = await request(`/roles/${compBRoleId}`, {
    token: sa.accessToken,
    companyId: companyB.id,
    method: 'DELETE',
  });
  assert(delRoleB.status === 200, 'Company B custom role deleted successfully');

  // 8. RBAC Test Matrix for all 8 standard roles
  console.log('\n8. Testing RBAC Access Matrix Across All 8 Roles...');
  const roleChecks = [
    { name: 'SUPER_ADMIN', token: sa.accessToken, canList: true, canCreate: true },
    { name: 'OWNER', token: owner.accessToken, canList: true, canCreate: true, companyId: companyA.id },
    { name: 'ADMIN', token: admin.accessToken, canList: true, canCreate: false, companyId: companyA.id },
    { name: 'MANAGER', token: manager.accessToken, canList: false, canCreate: false, companyId: companyA.id },
    { name: 'DISPATCHER', token: dispatcher.accessToken, canList: false, canCreate: false, companyId: companyA.id },
    { name: 'ACCOUNTANT', token: accountant.accessToken, canList: false, canCreate: false, companyId: companyA.id },
    { name: 'DRIVER', token: driver.accessToken, canList: false, canCreate: false, companyId: companyA.id },
    { name: 'CUSTOMER', token: customer.accessToken, canList: false, canCreate: false, companyId: companyA.id },
  ];

  for (const check of roleChecks) {
    const listRes = await request('/roles', { token: check.token, companyId: check.companyId });
    const canListActual = listRes.status === 200;
    assert(
      canListActual === check.canList,
      `${check.name} View Roles: Expected ${check.canList ? 'ALLOWED (200)' : 'DENIED (403)'}, got ${listRes.status}`,
    );

    const createRes = await request('/roles', {
      token: check.token,
      companyId: check.companyId,
      method: 'POST',
      body: { name: `TestRole_${check.name}`, level: 15 },
    });
    const canCreateActual = createRes.status === 201;
    assert(
      canCreateActual === check.canCreate,
      `${check.name} Create Roles: Expected ${check.canCreate ? 'ALLOWED (201)' : 'DENIED (403)'}, got ${createRes.status}`,
    );

    if (canCreateActual) {
      // Clean up test role
      await request(`/roles/${createRes.data.id}`, { token: sa.accessToken, method: 'DELETE' });
    }
  }

  // 9. Verify Audit Log Records in Database
  console.log('\n9. Verifying Audit Log Records in Database...');
  const { createRequire } = await import('module');
  const path = await import('path');
  const require = createRequire(import.meta.url);
  const { prisma } = require(path.resolve(process.cwd(), 'packages/database/dist/client.js'));
  const rbacLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ['ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_PERMISSIONS_UPDATED', 'ROLE_DELETED'],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const loggedActions = new Set(rbacLogs.map((l) => l.action));
  assert(loggedActions.has('ROLE_CREATED'), 'AuditLog recorded ROLE_CREATED event');
  assert(loggedActions.has('ROLE_UPDATED'), 'AuditLog recorded ROLE_UPDATED event');
  assert(loggedActions.has('ROLE_PERMISSIONS_UPDATED'), 'AuditLog recorded ROLE_PERMISSIONS_UPDATED event');
  assert(loggedActions.has('ROLE_DELETED'), 'AuditLog recorded ROLE_DELETED event');
  console.log(`   Found ${rbacLogs.length} recent RBAC audit events in audit_logs table.`);
  await prisma.$disconnect();

  // Summary
  console.log('\n=============================================================');
  console.log(`Module 8B Verification Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
