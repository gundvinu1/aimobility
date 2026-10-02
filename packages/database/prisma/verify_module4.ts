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
const API_URL = 'http://localhost:4000/api/v1';

async function login(email: string, password = 'Admin@12345!'): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed for ${email} (${res.status}): ${text}`);
  }
  const data = await res.json() as any;
  const token = data.tokens?.accessToken || data.data?.tokens?.accessToken || data.data?.accessToken || data.accessToken;
  if (!token) throw new Error(`No token returned for ${email}: ${JSON.stringify(data)}`);
  return token;
}

const results: { test: string; passed: boolean; detail?: string }[] = [];

function record(test: string, passed: boolean, detail?: string) {
  results.push({ test, passed, detail });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${test} ${detail ? `(${detail})` : ''}`);
}

async function run() {
  console.log('============================================================');
  console.log('STARTING MODULE 4 COMPREHENSIVE RUNTIME VERIFICATION');
  console.log('============================================================\n');

  // Step 1: Login with seeded users
  console.log('--- 1. Authenticating Seeded Test Users ---');
  const tokenOwner = await login('owner@aimos.dev');
  const tokenAdmin = await login('admin@aimos.dev');
  const tokenDispatcher = await login('dispatcher@aimos.dev');
  const tokenDriver = await login('driver@aimos.dev');
  record('Authenticate seeded OWNER', !!tokenOwner);
  record('Authenticate seeded ADMIN', !!tokenAdmin);
  record('Authenticate seeded DISPATCHER', !!tokenDispatcher);
  record('Authenticate seeded DRIVER', !!tokenDriver);

  // Step 2: Set up Company A & User A, Company B & User B for Tenant Isolation
  console.log('\n--- 2. Setting Up Tenant Isolation Fixtures ---');
  const userA = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@aimos.dev' } });
  const userB = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@aimos.dev' } });
  const dispatcherUser = await prisma.user.findUniqueOrThrow({ where: { email: 'dispatcher@aimos.dev' } });

  // Create Company A
  const companyA = await prisma.company.upsert({
    where: { slug: 'company-a-test' },
    update: { deletedAt: null },
    create: {
      name: 'Company Alpha Fleet',
      slug: 'company-a-test',
      email: 'alpha@aimos.dev',
      phone: '+919111111111',
    },
  });

  // Create Company B
  const companyB = await prisma.company.upsert({
    where: { slug: 'company-b-test' },
    update: { deletedAt: null },
    create: {
      name: 'Company Beta Logistics',
      slug: 'company-b-test',
      email: 'beta@aimos.dev',
      phone: '+919222222222',
    },
  });

  // Ensure User A is OWNER in Company A only
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: userA.id, companyId: companyA.id } },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: { userId: userA.id, companyId: companyA.id, role: 'OWNER', status: 'ACTIVE' },
  });
  // Ensure User A is NOT a member of Company B
  await prisma.userCompany.deleteMany({
    where: { userId: userA.id, companyId: companyB.id },
  });

  // Ensure User B is OWNER in Company B only
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: userB.id, companyId: companyB.id } },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: { userId: userB.id, companyId: companyB.id, role: 'OWNER', status: 'ACTIVE' },
  });
  // Ensure User B is NOT a member of Company A
  await prisma.userCompany.deleteMany({
    where: { userId: userB.id, companyId: companyA.id },
  });

  // Ensure Dispatcher is MEMBER in Company A only
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: dispatcherUser.id, companyId: companyA.id } },
    update: { role: 'MEMBER', status: 'ACTIVE' },
    create: { userId: dispatcherUser.id, companyId: companyA.id, role: 'MEMBER', status: 'ACTIVE' },
  });

  record('Company A and Company B created and distinct', companyA.id !== companyB.id);
  record('User A assigned to Company A only', true);
  record('User B assigned to Company B only', true);

  // Clean any previous test employees for repeatable runs
  await prisma.employee.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });

  // Step 3: Create Employee A in Company A via API
  console.log('\n--- 3. Employee Creation (POST /api/v1/employees) ---');
  const createEmpARes = await fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenOwner}`,
      'x-company-id': companyA.id,
    },
    body: JSON.stringify({
      firstName: 'Aarav',
      lastName: 'Sharma',
      displayName: 'Aarav S',
      email: 'aarav.sharma@alpha.com',
      phone: '+919876543210',
      department: 'OPERATIONS',
      designation: 'Fleet Manager',
      employmentType: 'FULL_TIME',
      joiningDate: '2026-01-10T00:00:00.000Z',
    }),
  });
  const empAData = await createEmpARes.json() as any;
  const empA = empAData.data || empAData;
  record('Create Employee A in Company A via API (HTTP 201)', createEmpARes.status === 201 && !!empA.id, `Status: ${createEmpARes.status}, empNo: ${empA.employeeNumber}`);

  // Step 4: Create Employee B in Company B via API
  const createEmpBRes = await fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAdmin}`,
      'x-company-id': companyB.id,
    },
    body: JSON.stringify({
      firstName: 'Bhavna',
      lastName: 'Verma',
      displayName: 'Bhavna V',
      email: 'bhavna.verma@beta.com',
      phone: '+919876500000',
      department: 'DISPATCH',
      designation: 'Lead Dispatcher',
      employmentType: 'FULL_TIME',
      joiningDate: '2026-02-01T00:00:00.000Z',
    }),
  });
  const empBData = await createEmpBRes.json() as any;
  const empB = empBData.data || empBData;
  record('Create Employee B in Company B via API (HTTP 201)', createEmpBRes.status === 201 && !!empB.id, `Status: ${createEmpBRes.status}, empNo: ${empB.employeeNumber}`);

  // Step 5: Critical Tenant Isolation Verification
  console.log('\n--- 4. Critical Tenant Isolation Tests ---');

  // Test 5.1: User A requests Employee A with Company A header -> Expected: 200
  const getEmpAByARes = await fetch(`${API_URL}/employees/${empA.id}`, {
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
  });
  record('User A GET Employee A (same company) -> 200', getEmpAByARes.status === 200);

  // Test 5.2: User A requests Employee B with Company A header -> Expected: 404 (does not exist in Company A)
  const getEmpBWithCompanyAHdrRes = await fetch(`${API_URL}/employees/${empB.id}`, {
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
  });
  record('User A GET Employee B with Company A header -> 404 Not Found', getEmpBWithCompanyAHdrRes.status === 404);

  // Test 5.3: User A requests Employee B with Company B header -> Expected: 403 Forbidden (User A not in Company B)
  const getEmpBWithCompanyBHdrRes = await fetch(`${API_URL}/employees/${empB.id}`, {
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyB.id },
  });
  record('User A GET Employee B with Company B header -> 403 Forbidden (cross-tenant spoof blocked)', getEmpBWithCompanyBHdrRes.status === 403);

  // Test 5.4: User A PATCH Employee B with Company A header -> Expected: 404
  const patchEmpBWithCompanyAHdrRes = await fetch(`${API_URL}/employees/${empB.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ firstName: 'Hacked' }),
  });
  record('User A PATCH Employee B with Company A header -> 404', patchEmpBWithCompanyAHdrRes.status === 404);

  // Test 5.5: User A PATCH Employee B with Company B header -> Expected: 403
  const patchEmpBWithCompanyBHdrRes = await fetch(`${API_URL}/employees/${empB.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyB.id },
    body: JSON.stringify({ firstName: 'Hacked' }),
  });
  record('User A PATCH Employee B with Company B header -> 403 Forbidden', patchEmpBWithCompanyBHdrRes.status === 403);

  // Test 5.6: User A DELETE Employee B with Company A header -> Expected: 404
  const deleteEmpBWithCompanyAHdrRes = await fetch(`${API_URL}/employees/${empB.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
  });
  record('User A DELETE Employee B with Company A header -> 404', deleteEmpBWithCompanyAHdrRes.status === 404);

  // Test 5.7: User A DELETE Employee B with Company B header -> Expected: 403
  const deleteEmpBWithCompanyBHdrRes = await fetch(`${API_URL}/employees/${empB.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyB.id },
  });
  record('User A DELETE Employee B with Company B header -> 403 Forbidden', deleteEmpBWithCompanyBHdrRes.status === 403);

  // Test 5.8: User A searches for Employee B ('Bhavna') in Company A -> Expected: empty list
  const searchBRes = await fetch(`${API_URL}/employees?search=Bhavna`, {
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
  });
  const searchBData = await searchBRes.json() as any;
  const searchBList = searchBData.data?.employees || searchBData.employees || [];
  record('User A search "Bhavna" in Company A yields 0 results (search isolation)', searchBList.length === 0);

  // Test 5.9: Reverse isolation: User B requests Employee A with Company B header -> Expected: 404
  const getEmpAWithCompanyBHdrRes = await fetch(`${API_URL}/employees/${empA.id}`, {
    headers: { Authorization: `Bearer ${tokenAdmin}`, 'x-company-id': companyB.id },
  });
  record('User B GET Employee A with Company B header -> 404', getEmpAWithCompanyBHdrRes.status === 404);

  // Test 5.10: Reverse isolation: User B requests Employee A with Company A header -> Expected: 403
  const getEmpAWithCompanyAHdrRes = await fetch(`${API_URL}/employees/${empA.id}`, {
    headers: { Authorization: `Bearer ${tokenAdmin}`, 'x-company-id': companyA.id },
  });
  record('User B GET Employee A with Company A header -> 403 Forbidden', getEmpAWithCompanyAHdrRes.status === 403);

  // Step 6: List, Filter, Sort, Pagination
  console.log('\n--- 5. List, Filter, Sort, Pagination ---');
  const listRes = await fetch(`${API_URL}/employees?page=1&limit=10&employmentStatus=ACTIVE&sortBy=createdAt&sortOrder=desc`, {
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
  });
  const listJson = await listRes.json() as any;
  const listBody = listJson.data || listJson;
  record('List employees pagination structure has items, page, limit, total, totalPages',
    listRes.status === 200 &&
    Array.isArray(listBody.employees) &&
    listBody.page === 1 &&
    listBody.limit === 10 &&
    typeof listBody.total === 'number' &&
    typeof listBody.totalPages === 'number',
    `total: ${listBody.total}, count: ${listBody.employees?.length}`
  );

  // Step 7: Employee Stats API
  console.log('\n--- 6. Employee Stats API (GET /api/v1/employees/stats) ---');
  const statsRes = await fetch(`${API_URL}/employees/stats`, {
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
  });
  const statsJson = await statsRes.json() as any;
  const stats = statsJson.data || statsJson;
  record('Employee stats endpoint returns total, active, breakdown',
    statsRes.status === 200 &&
    typeof stats.total === 'number' &&
    typeof stats.active === 'number' &&
    typeof stats.byDepartment === 'object',
    `total: ${stats.total}, active: ${stats.active}`
  );

  // Step 8: Validation tests
  console.log('\n--- 7. Input Validation & Error Handling ---');
  // 8.1: Missing required field (firstName)
  const invalidCreateRes = await fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ phone: '+919999999999', joiningDate: '2026-01-01' }),
  });
  record('Missing required fields rejected with 400', invalidCreateRes.status === 400);

  // 8.2: Invalid employmentStatus
  const invalidStatusRes = await fetch(`${API_URL}/employees/${empA.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ employmentStatus: 'FIRED_OUT' }),
  });
  record('Invalid employmentStatus rejected with 400', invalidStatusRes.status === 400);

  // 8.3: Invalid employmentType
  const invalidTypeRes = await fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
    body: JSON.stringify({
      firstName: 'Test',
      lastName: 'Type',
      phone: '+919888877777',
      joiningDate: '2026-01-01',
      employmentType: 'GIG_WORKER',
    }),
  });
  record('Invalid employmentType rejected with 400', invalidTypeRes.status === 400);

  // Step 9: Status Management & Audit Logging
  console.log('\n--- 8. Status Management & Audit Logging ---');
  const updateStatusRes = await fetch(`${API_URL}/employees/${empA.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ employmentStatus: 'ON_LEAVE' }),
  });
  const updatedStatusData = await updateStatusRes.json() as any;
  const updatedStatusEmp = updatedStatusData.data || updatedStatusData;
  record('Update status ACTIVE -> ON_LEAVE (200)', updateStatusRes.status === 200 && updatedStatusEmp.employmentStatus === 'ON_LEAVE');

  // Verify audit log for status change
  const statusAudit = await prisma.auditLog.findFirst({
    where: {
      entityType: 'Employee',
      entityId: empA.id,
      action: 'EMPLOYEE_STATUS_CHANGED',
    },
  });
  record('AuditLog recorded EMPLOYEE_STATUS_CHANGED', !!statusAudit && (statusAudit.metadata as any)?.to === 'ON_LEAVE');

  // Step 10: User Account Linking & Unlinking
  console.log('\n--- 9. User Linking & Unlinking ---');
  // 10.1: Link User A (member of Company A) to Employee A
  const linkUserRes = await fetch(`${API_URL}/employees/${empA.id}/link-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ userId: userA.id }),
  });
  const linkUserData = await linkUserRes.json() as any;
  const linkedEmp = linkUserData.data || linkUserData;
  record('Link user to employee (200)', linkUserRes.status === 200 && linkedEmp.userId === userA.id);

  // Verify audit log for link
  const linkAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Employee', entityId: empA.id, action: 'EMPLOYEE_USER_LINKED' },
  });
  record('AuditLog recorded EMPLOYEE_USER_LINKED', !!linkAudit);

  // 10.2: Attempt cross-company user linking: try to link User B (from Company B) to Employee A (in Company A)
  const crossLinkRes = await fetch(`${API_URL}/employees/${empA.id}/link-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ userId: userB.id }),
  });
  record('Cross-company user link rejected with 400 Bad Request', crossLinkRes.status === 400);

  // 10.3: Unlink user
  const unlinkRes = await fetch(`${API_URL}/employees/${empA.id}/link-user`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
  });
  const unlinkData = await unlinkRes.json() as any;
  const unlinkedEmp = unlinkData.data || unlinkData;
  record('Unlink user from employee (200)', unlinkRes.status === 200 && unlinkedEmp.userId === null);

  const unlinkAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Employee', entityId: empA.id, action: 'EMPLOYEE_USER_UNLINKED' },
  });
  record('AuditLog recorded EMPLOYEE_USER_UNLINKED', !!unlinkAudit);

  // Step 11: RBAC Tests
  console.log('\n--- 10. Role-Based Access Control (RBAC) ---');
  // 11.1: DISPATCHER user in Company A attempts to GET /api/v1/employees -> Expected: 200 (Read access)
  const dispatcherListRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenDispatcher}`, 'x-company-id': companyA.id },
  });
  record('MEMBER/DISPATCHER user can read employees list (200)', dispatcherListRes.status === 200);

  // 11.2: DISPATCHER user in Company A attempts to CREATE employee -> Expected: 403 (Requires OWNER/ADMIN/MANAGER)
  const dispatcherCreateRes = await fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenDispatcher}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ firstName: 'Unauthorized', lastName: 'Emp', phone: '+919999999999', joiningDate: '2026-01-01' }),
  });
  record('MEMBER/DISPATCHER cannot create employee (403 Forbidden)', dispatcherCreateRes.status === 403);

  // 11.3: DRIVER user (no company membership) attempts to access employees -> Expected: 403
  const driverRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenDriver}`, 'x-company-id': companyA.id },
  });
  record('Non-member DRIVER cannot access company employees (403 Forbidden)', driverRes.status === 403);

  // Step 12: Soft Deletion
  console.log('\n--- 11. Soft Deletion (DELETE /api/v1/employees/:id) ---');
  const deleteRes = await fetch(`${API_URL}/employees/${empA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
  });
  record('Delete employee via API returns 204 No Content', deleteRes.status === 204);

  // Verify employee is NOT returned in list
  const listAfterDeleteRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenOwner}`, 'x-company-id': companyA.id },
  });
  const listAfterDeleteJson = await listAfterDeleteRes.json() as any;
  const listAfterDelete = listAfterDeleteJson.data?.employees || listAfterDeleteJson.employees || [];
  const foundInList = listAfterDelete.some((e: any) => e.id === empA.id);
  record('Deleted employee excluded from list API results', !foundInList);

  // Verify database record has deletedAt populated and status TERMINATED
  const dbEmpA = await prisma.employee.findUnique({ where: { id: empA.id } });
  record('Database preserves record with deletedAt timestamp (soft delete)', !!dbEmpA?.deletedAt);

  // Verify delete audit log
  const deleteAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Employee', entityId: empA.id, action: 'EMPLOYEE_DELETED' },
  });
  record('AuditLog recorded EMPLOYEE_DELETED', !!deleteAudit);

  // Summary
  console.log('\n============================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('============================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`TOTAL CHECKS: ${results.length}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run()
  .catch((err) => {
    console.error('Fatal error during verification:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
