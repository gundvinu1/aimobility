import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public';
}

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000/api/v1';

export interface QaRow {
  test: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
  evidence?: string;
}

const qaResults: QaRow[] = [];

function record(test: string, expected: string, actual: string, passed: boolean, evidence?: string) {
  const status = passed ? 'PASS' : 'FAIL';
  qaResults.push({ test, expected, actual, status, evidence });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${status}] ${test} | Expected: ${expected} | Actual: ${actual}`);
}

async function login(email: string, password = 'Admin@12345!'): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as any;
  const token = data.tokens?.accessToken || data.data?.tokens?.accessToken || data.data?.accessToken || data.accessToken;
  if (!token) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return token;
}

async function run() {
  console.log('============================================================');
  console.log('STARTING AI-MOS MODULE 4 MASTER QA TEST SUITE');
  console.log('============================================================\n');

  // ─── PHASE 5: AUTHENTICATION TEST ──────────────────────────────────────────
  console.log('--- PHASE 5: Authentication Tests ---');
  // 5.1 Valid login
  let tokenOwnerA = '';
  try {
    tokenOwnerA = await login('owner@aimos.dev');
    record('Valid login returns access token', 'HTTP 200 with JWT', 'HTTP 200 with valid JWT', !!tokenOwnerA, 'owner@aimos.dev');
  } catch (err: any) {
    record('Valid login returns access token', 'HTTP 200 with JWT', err.message, false);
  }

  // 5.2 Invalid credentials
  const invalidLoginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@aimos.dev', password: 'WrongPassword123!' }),
  });
  record('Invalid credentials rejected', 'HTTP 401 Unauthorized', `HTTP ${invalidLoginRes.status}`, invalidLoginRes.status === 401);

  // 5.3 Unauthenticated access to protected employee endpoint
  const unauthRes = await fetch(`${API_URL}/employees`);
  record('Unauthenticated access to employees blocked', 'HTTP 401 Unauthorized', `HTTP ${unauthRes.status}`, unauthRes.status === 401);

  // ─── PHASE 6: COMPANY/TENANT TEST DATA ─────────────────────────────────────
  console.log('\n--- PHASE 6: Tenant Setup ---');
  const userA = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@aimos.dev' } });
  const userB = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@aimos.dev' } });

  const companyA = await prisma.company.upsert({
    where: { slug: 'company-a-test' },
    update: { deletedAt: null },
    create: { name: 'Company Alpha Fleet', slug: 'company-a-test', email: 'alpha@aimos.dev', phone: '+919111111111' },
  });

  const companyB = await prisma.company.upsert({
    where: { slug: 'company-b-test' },
    update: { deletedAt: null },
    create: { name: 'Company Beta Logistics', slug: 'company-b-test', email: 'beta@aimos.dev', phone: '+919222222222' },
  });

  // User A -> Company A (OWNER)
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: userA.id, companyId: companyA.id } },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: { userId: userA.id, companyId: companyA.id, role: 'OWNER', status: 'ACTIVE' },
  });
  await prisma.userCompany.deleteMany({ where: { userId: userA.id, companyId: companyB.id } });

  // User B -> Company B (OWNER)
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: userB.id, companyId: companyB.id } },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: { userId: userB.id, companyId: companyB.id, role: 'OWNER', status: 'ACTIVE' },
  });
  await prisma.userCompany.deleteMany({ where: { userId: userB.id, companyId: companyA.id } });

  const tokenOwnerB = await login('admin@aimos.dev');

  record('Tenant setup: Company A and B isolated', 'Two distinct companies with segregated memberships', `CompA: ${companyA.name}, CompB: ${companyB.name}`, companyA.id !== companyB.id);

  // Clean test employee records for repeatable run
  await prisma.employee.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });

  // ─── PHASE 7: EMPLOYEE CREATE TEST ─────────────────────────────────────────
  console.log('\n--- PHASE 7: Employee Create Test ---');
  const createEmpARes = await fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenOwnerA}`,
      'x-company-id': companyA.id,
    },
    body: JSON.stringify({
      firstName: 'Rahul',
      lastName: 'Patil',
      department: 'OPERATIONS',
      designation: 'Operations Manager',
      employmentType: 'FULL_TIME',
      joiningDate: '2026-01-15T00:00:00.000Z',
      phone: '+919876543210',
      email: 'rahul.patil@alpha.com',
    }),
  });
  const empAData = await createEmpARes.json() as any;
  const empA = empAData.data || empAData;
  const empNumberA = empA.employeeNumber;

  const dbEmpA = await prisma.employee.findUnique({ where: { id: empA.id } });
  const createAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Employee', entityId: empA.id, action: 'EMPLOYEE_CREATED' },
  });

  record(
    'Create Employee A in Company A',
    'HTTP 201, stored in DB, companyId=Company A, audit log created',
    `HTTP ${createEmpARes.status}, empNumber=${empNumberA}, auditLog=${!!createAudit}`,
    createEmpARes.status === 201 && dbEmpA?.companyId === companyA.id && !!createAudit,
    `ID: ${empA.id}, Number: ${empNumberA}`
  );

  // ─── PHASE 8: DUPLICATE EMPLOYEE NUMBER TEST ───────────────────────────────
  console.log('\n--- PHASE 8: Duplicate Employee Number Test ---');
  // 8.1 In same company, auto-generation or duplicate collision handling:
  // In our schema, employee numbers are unique per company @@unique([companyId, employeeNumber])
  // Try inserting duplicate employeeNumber directly into Prisma to test @@unique([companyId, employeeNumber])
  let duplicateRejectedInSameCompany = false;
  try {
    await prisma.employee.create({
      data: {
        companyId: companyA.id,
        employeeNumber: empNumberA, // duplicate in Company A!
        firstName: 'Duplicate',
        lastName: 'Test',
        phone: '+919000000000',
        joiningDate: new Date(),
      },
    });
  } catch (err: any) {
    duplicateRejectedInSameCompany = err.message.includes('Unique constraint failed') || err.code === 'P2002';
  }
  record(
    'Duplicate employeeNumber in same company rejected by database constraint',
    'Rejection via unique constraint P2002',
    duplicateRejectedInSameCompany ? 'P2002 Unique constraint failed' : 'Allowed (Unexpected)',
    duplicateRejectedInSameCompany
  );

  // 8.2 In different company (Company B), same employeeNumber is allowed:
  let allowedInDifferentCompany = false;
  try {
    const empDiff = await prisma.employee.create({
      data: {
        companyId: companyB.id,
        employeeNumber: empNumberA, // same number in Company B!
        firstName: 'Bhavna',
        lastName: 'Verma',
        phone: '+919888888888',
        joiningDate: new Date(),
      },
    });
    allowedInDifferentCompany = !!empDiff.id;
  } catch {
    allowedInDifferentCompany = false;
  }
  record(
    'Same employeeNumber allowed in different company (Company B)',
    'Allowed (Unique per company)',
    allowedInDifferentCompany ? 'Created successfully in Company B' : 'Failed',
    allowedInDifferentCompany
  );

  // ─── PHASE 9: EMPLOYEE LIST TEST ───────────────────────────────────────────
  console.log('\n--- PHASE 9: Employee List Test ---');
  const listRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  const listJson = await listRes.json() as any;
  const listData = listJson.data || listJson;
  const listEmployees = listData.employees || [];
  const onlyCompanyA = listEmployees.every((e: any) => e.companyId === companyA.id);

  record(
    'List employees returns active company records with pagination',
    'HTTP 200, array of items, page/limit/total present, only Company A',
    `HTTP ${listRes.status}, count=${listEmployees.length}, total=${listData.total}, onlyCompA=${onlyCompanyA}`,
    listRes.status === 200 && Array.isArray(listEmployees) && onlyCompanyA && typeof listData.total === 'number'
  );

  // ─── PHASE 10: SEARCH TEST ─────────────────────────────────────────────────
  console.log('\n--- PHASE 10: Search Test ---');
  // Search firstName
  const searchNameRes = await fetch(`${API_URL}/employees?search=Rahul`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  const searchNameJson = await searchNameRes.json() as any;
  const searchNameList = (searchNameJson.data || searchNameJson).employees || [];
  const foundByName = searchNameList.some((e: any) => e.firstName === 'Rahul');

  // Search designation
  const searchDesigRes = await fetch(`${API_URL}/employees?search=Operations`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  const searchDesigJson = await searchDesigRes.json() as any;
  const searchDesigList = (searchDesigJson.data || searchDesigJson).employees || [];
  const foundByDesig = searchDesigList.some((e: any) => e.id === empA.id);

  // Cross-tenant search (search for Company B employee "Bhavna" from Company A)
  const searchCrossRes = await fetch(`${API_URL}/employees?search=Bhavna`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  const searchCrossJson = await searchCrossRes.json() as any;
  const searchCrossList = (searchCrossJson.data || searchCrossJson).employees || [];
  const crossIsolated = searchCrossList.length === 0;

  record('Search by first name ("Rahul")', 'Returns Employee A', `Matches: ${searchNameList.length}`, foundByName);
  record('Search by designation ("Operations")', 'Returns Employee A', `Matches: ${searchDesigList.length}`, foundByDesig);
  record('Search isolation: Company A user cannot find Company B employee ("Bhavna")', '0 results', `Matches: ${searchCrossList.length}`, crossIsolated);

  // ─── PHASE 11: FILTER TEST ─────────────────────────────────────────────────
  console.log('\n--- PHASE 11: Filter Test ---');
  const filterDeptRes = await fetch(`${API_URL}/employees?department=OPERATIONS`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  const filterDeptJson = await filterDeptRes.json() as any;
  const filterDeptList = (filterDeptJson.data || filterDeptJson).employees || [];

  const filterStatusRes = await fetch(`${API_URL}/employees?employmentStatus=ACTIVE`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  const filterStatusJson = await filterStatusRes.json() as any;
  const filterStatusList = (filterStatusJson.data || filterStatusJson).employees || [];

  record('Filter by department=OPERATIONS', 'Returns matching employee', `Matches: ${filterDeptList.length}`, filterDeptList.length > 0 && filterDeptList[0].department === 'OPERATIONS');
  record('Filter by employmentStatus=ACTIVE', 'Returns matching employee', `Matches: ${filterStatusList.length}`, filterStatusList.length > 0 && filterStatusList[0].employmentStatus === 'ACTIVE');

  // ─── PHASE 12: PAGINATION TEST ─────────────────────────────────────────────
  console.log('\n--- PHASE 12: Pagination Test ---');
  // Create 3 additional employees in Company A to test pagination with limit=2
  for (let i = 1; i <= 3; i++) {
    await fetch(`${API_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
      body: JSON.stringify({
        firstName: `BatchEmp${i}`,
        lastName: 'Pagination',
        phone: `+91900000000${i}`,
        department: 'DISPATCH',
        joiningDate: '2026-01-01T00:00:00.000Z',
      }),
    });
  }

  const page1Res = await fetch(`${API_URL}/employees?page=1&limit=2`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  const page1Json = await page1Res.json() as any;
  const page1 = page1Json.data || page1Json;

  const page2Res = await fetch(`${API_URL}/employees?page=2&limit=2`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  const page2Json = await page2Res.json() as any;
  const page2 = page2Json.data || page2Json;

  const p1Ids = new Set((page1.employees || []).map((e: any) => e.id));
  const noDuplicates = (page2.employees || []).every((e: any) => !p1Ids.has(e.id));

  record(
    'Pagination: page=1 and page=2 return non-overlapping sets',
    'No duplicates between page 1 and page 2, totalPages calculated',
    `P1 count: ${page1.employees?.length}, P2 count: ${page2.employees?.length}, total: ${page1.total}, totalPages: ${page1.totalPages}`,
    page1Res.status === 200 && page2Res.status === 200 && noDuplicates && page1.totalPages >= 2
  );

  // ─── PHASE 13: EMPLOYEE DETAILS TEST ───────────────────────────────────────
  console.log('\n--- PHASE 13: Employee Details Test ---');
  const detailsRes = await fetch(`${API_URL}/employees/${empA.id}`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  const detailsJson = await detailsRes.json() as any;
  const details = detailsJson.data || detailsJson;
  record('Get employee details by ID', 'HTTP 200, matching employee', `HTTP ${detailsRes.status}, Name: ${details.firstName} ${details.lastName}`, detailsRes.status === 200 && details.id === empA.id);

  // Invalid UUID
  const invalidIdRes = await fetch(`${API_URL}/employees/not-a-valid-uuid`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  record('Invalid UUID returns 400', 'HTTP 400 Bad Request', `HTTP ${invalidIdRes.status}`, invalidIdRes.status === 400);

  // ─── PHASE 14: EMPLOYEE UPDATE TEST ────────────────────────────────────────
  console.log('\n--- PHASE 14: Employee Update Test ---');
  const updateRes = await fetch(`${API_URL}/employees/${empA.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
    body: JSON.stringify({
      designation: 'Senior Operations Director',
      phone: '+919876599999',
      notes: 'Promoted to Director',
    }),
  });
  const updateJson = await updateRes.json() as any;
  const updatedEmp = updateJson.data || updateJson;
  const updateAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Employee', entityId: empA.id, action: 'EMPLOYEE_UPDATED' },
  });

  record(
    'Update employee details via PATCH',
    'HTTP 200, updated fields reflected in DB, audit log created',
    `HTTP ${updateRes.status}, designation=${updatedEmp.designation}, auditLog=${!!updateAudit}`,
    updateRes.status === 200 && updatedEmp.designation === 'Senior Operations Director' && !!updateAudit
  );

  // ─── PHASE 15: STATUS MANAGEMENT TEST ──────────────────────────────────────
  console.log('\n--- PHASE 15: Status Management Test ---');
  // Transition ACTIVE -> ON_LEAVE
  const statusRes = await fetch(`${API_URL}/employees/${empA.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ employmentStatus: 'ON_LEAVE' }),
  });
  const statusJson = await statusRes.json() as any;
  const statusEmp = statusJson.data || statusJson;
  const statusAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Employee', entityId: empA.id, action: 'EMPLOYEE_STATUS_CHANGED' },
  });

  record(
    'Status transition: ACTIVE -> ON_LEAVE',
    'HTTP 200, status=ON_LEAVE, audit log created',
    `HTTP ${statusRes.status}, status=${statusEmp.employmentStatus}, auditLog=${!!statusAudit}`,
    statusRes.status === 200 && statusEmp.employmentStatus === 'ON_LEAVE' && !!statusAudit
  );

  // Invalid status
  const invalidStatusRes = await fetch(`${API_URL}/employees/${empA.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ employmentStatus: 'BOGUS_STATUS' }),
  });
  record('Invalid status transition rejected', 'HTTP 400 Bad Request', `HTTP ${invalidStatusRes.status}`, invalidStatusRes.status === 400);

  // ─── PHASE 16: SOFT DELETE TEST ────────────────────────────────────────────
  console.log('\n--- PHASE 16: Soft Delete Test ---');
  const deleteRes = await fetch(`${API_URL}/employees/${empA.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  record('DELETE /api/employees/:id succeeds', 'HTTP 204 No Content', `HTTP ${deleteRes.status}`, deleteRes.status === 204);

  // Check database row
  const dbEmpAfterDelete = await prisma.employee.findUnique({ where: { id: empA.id } });
  record('Database soft delete retains record with deletedAt timestamp', 'deletedAt != null, record exists', `deletedAt=${dbEmpAfterDelete?.deletedAt?.toISOString()}`, !!dbEmpAfterDelete?.deletedAt);

  // Check excluded from list
  const listAfterDelRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  const listAfterDelJson = await listAfterDelRes.json() as any;
  const listAfterDel = (listAfterDelJson.data || listAfterDelJson).employees || [];
  const excludedFromList = !listAfterDel.some((e: any) => e.id === empA.id);
  record('Deleted employee excluded from list API', 'Employee not in results', `Found: ${!excludedFromList}`, excludedFromList);

  // ─── PHASE 17: CRITICAL TENANT ISOLATION TEST ──────────────────────────────
  console.log('\n--- PHASE 17: Critical Tenant Isolation Test ---');
  // Create fresh Employee Alpha in Company A and Employee Beta in Company B
  const cA_empRes = await fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ firstName: 'TenantIsoA', lastName: 'Alpha', phone: '+919100000000', joiningDate: '2026-01-01T00:00:00.000Z' }),
  });
  const cA_json = (await cA_empRes.json()) as any;
  const cA_emp = cA_json.data || cA_json;

  const cB_empRes = await fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerB}`, 'x-company-id': companyB.id },
    body: JSON.stringify({ firstName: 'TenantIsoB', lastName: 'Beta', phone: '+919200000000', joiningDate: '2026-01-01T00:00:00.000Z' }),
  });
  const cB_json = (await cB_empRes.json()) as any;
  const cB_emp = cB_json.data || cB_json;

  // User A -> GET Employee A -> 200
  const isoGetA_byA = await fetch(`${API_URL}/employees/${cA_emp.id}`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  record('Tenant Isolation: User A GET Employee A (same company)', 'HTTP 200 OK', `HTTP ${isoGetA_byA.status}`, isoGetA_byA.status === 200);

  // User A -> GET Employee B with Company A header -> 404
  const isoGetB_byA_hdrA = await fetch(`${API_URL}/employees/${cB_emp.id}`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  record('Tenant Isolation: User A GET Employee B with Company A header', 'HTTP 404 Not Found', `HTTP ${isoGetB_byA_hdrA.status}`, isoGetB_byA_hdrA.status === 404);

  // User A -> GET Employee B with Company B header -> 403 (User A is not in Company B)
  const isoGetB_byA_hdrB = await fetch(`${API_URL}/employees/${cB_emp.id}`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyB.id },
  });
  record('Tenant Isolation: User A GET Employee B with Company B header', 'HTTP 403 Forbidden', `HTTP ${isoGetB_byA_hdrB.status}`, isoGetB_byA_hdrB.status === 403);

  // User A -> PATCH Employee B with Company A header -> 404
  const isoPatchB_byA_hdrA = await fetch(`${API_URL}/employees/${cB_emp.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ firstName: 'Hacked' }),
  });
  record('Tenant Isolation: User A PATCH Employee B with Company A header', 'HTTP 404 Not Found', `HTTP ${isoPatchB_byA_hdrA.status}`, isoPatchB_byA_hdrA.status === 404);

  // User A -> PATCH Employee B with Company B header -> 403
  const isoPatchB_byA_hdrB = await fetch(`${API_URL}/employees/${cB_emp.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyB.id },
    body: JSON.stringify({ firstName: 'Hacked' }),
  });
  record('Tenant Isolation: User A PATCH Employee B with Company B header', 'HTTP 403 Forbidden', `HTTP ${isoPatchB_byA_hdrB.status}`, isoPatchB_byA_hdrB.status === 403);

  // User A -> DELETE Employee B with Company A header -> 404
  const isoDelB_byA_hdrA = await fetch(`${API_URL}/employees/${cB_emp.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyA.id },
  });
  record('Tenant Isolation: User A DELETE Employee B with Company A header', 'HTTP 404 Not Found', `HTTP ${isoDelB_byA_hdrA.status}`, isoDelB_byA_hdrA.status === 404);

  // User A -> DELETE Employee B with Company B header -> 403
  const isoDelB_byA_hdrB = await fetch(`${API_URL}/employees/${cB_emp.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': companyB.id },
  });
  record('Tenant Isolation: User A DELETE Employee B with Company B header', 'HTTP 403 Forbidden', `HTTP ${isoDelB_byA_hdrB.status}`, isoDelB_byA_hdrB.status === 403);

  // Reverse: User B -> GET Employee A with Company B header -> 404
  const isoGetA_byB_hdrB = await fetch(`${API_URL}/employees/${cA_emp.id}`, {
    headers: { Authorization: `Bearer ${tokenOwnerB}`, 'x-company-id': companyB.id },
  });
  record('Tenant Isolation (Reverse): User B GET Employee A with Company B header', 'HTTP 404 Not Found', `HTTP ${isoGetA_byB_hdrB.status}`, isoGetA_byB_hdrB.status === 404);

  // Reverse: User B -> GET Employee A with Company A header -> 403
  const isoGetA_byB_hdrA = await fetch(`${API_URL}/employees/${cA_emp.id}`, {
    headers: { Authorization: `Bearer ${tokenOwnerB}`, 'x-company-id': companyA.id },
  });
  record('Tenant Isolation (Reverse): User B GET Employee A with Company A header', 'HTTP 403 Forbidden', `HTTP ${isoGetA_byB_hdrA.status}`, isoGetA_byB_hdrA.status === 403);

  // ─── PHASE 18: COMPANY HEADER TEST ─────────────────────────────────────────
  console.log('\n--- PHASE 18: Company Header Test ---');
  // Missing company ID
  const missingHdrRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}` },
  });
  record('Missing X-Company-ID header rejected', 'HTTP 400 Bad Request', `HTTP ${missingHdrRes.status}`, missingHdrRes.status === 400);

  // Invalid company ID format
  const invalidHdrRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': 'invalid-uuid-format' },
  });
  record('Invalid X-Company-ID format rejected', 'HTTP 400 Bad Request', `HTTP ${invalidHdrRes.status}`, invalidHdrRes.status === 400);

  // Non-existent company ID
  const nonExistentHdrRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}`, 'x-company-id': '00000000-0000-0000-0000-000000000000' },
  });
  record('Non-existent X-Company-ID rejected', 'HTTP 404 Not Found', `HTTP ${nonExistentHdrRes.status}`, nonExistentHdrRes.status === 404);

  // ─── PHASE 19: RBAC TEST ───────────────────────────────────────────────────
  console.log('\n--- PHASE 19: RBAC Role Testing ---');
  // Seeded roles: OWNER, ADMIN, MANAGER, DISPATCHER, ACCOUNTANT, DRIVER, CUSTOMER
  const tokenManager = await login('manager@aimos.dev');
  const tokenDispatcher = await login('dispatcher@aimos.dev');
  const tokenAccountant = await login('accountant@aimos.dev');
  const tokenDriver = await login('driver@aimos.dev');
  const tokenCustomer = await login('customer@aimos.dev');

  const managerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'manager@aimos.dev' } });
  const dispatcherUser = await prisma.user.findUniqueOrThrow({ where: { email: 'dispatcher@aimos.dev' } });
  const accountantUser = await prisma.user.findUniqueOrThrow({ where: { email: 'accountant@aimos.dev' } });

  // Add MANAGER, DISPATCHER, ACCOUNTANT as members of Company A with corresponding roles
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: managerUser.id, companyId: companyA.id } },
    update: { role: 'MANAGER', status: 'ACTIVE' },
    create: { userId: managerUser.id, companyId: companyA.id, role: 'MANAGER', status: 'ACTIVE' },
  });
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: dispatcherUser.id, companyId: companyA.id } },
    update: { role: 'MEMBER', status: 'ACTIVE' },
    create: { userId: dispatcherUser.id, companyId: companyA.id, role: 'MEMBER', status: 'ACTIVE' },
  });
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: accountantUser.id, companyId: companyA.id } },
    update: { role: 'MEMBER', status: 'ACTIVE' },
    create: { userId: accountantUser.id, companyId: companyA.id, role: 'MEMBER', status: 'ACTIVE' },
  });

  // Test 19.1: MANAGER CREATE -> Expected: 201
  const mgrCreateRes = await fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenManager}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ firstName: 'MgrCreated', lastName: 'Emp', phone: '+919999111122', joiningDate: '2026-01-01T00:00:00.000Z' }),
  });
  record('RBAC: MANAGER can CREATE employee', 'HTTP 201 Created', `HTTP ${mgrCreateRes.status}`, mgrCreateRes.status === 201);

  // Test 19.2: MANAGER DELETE -> Expected: 403 (DELETE requires OWNER or ADMIN)
  const mgrDelRes = await fetch(`${API_URL}/employees/${cA_emp.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenManager}`, 'x-company-id': companyA.id },
  });
  record('RBAC: MANAGER cannot DELETE employee (OWNER/ADMIN only)', 'HTTP 403 Forbidden', `HTTP ${mgrDelRes.status}`, mgrDelRes.status === 403);

  // Test 19.3: DISPATCHER READ -> Expected: 200
  const dispReadRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenDispatcher}`, 'x-company-id': companyA.id },
  });
  record('RBAC: DISPATCHER (MEMBER) can READ employees', 'HTTP 200 OK', `HTTP ${dispReadRes.status}`, dispReadRes.status === 200);

  // Test 19.3b: ACCOUNTANT READ -> Expected: 200
  const acctReadRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenAccountant}`, 'x-company-id': companyA.id },
  });
  record('RBAC: ACCOUNTANT (MEMBER) can READ employees', 'HTTP 200 OK', `HTTP ${acctReadRes.status}`, acctReadRes.status === 200);

  // Test 19.4: DISPATCHER CREATE -> Expected: 403
  const dispCreateRes = await fetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenDispatcher}`, 'x-company-id': companyA.id },
    body: JSON.stringify({ firstName: 'DispCreated', lastName: 'Emp', phone: '+919999333344', joiningDate: '2026-01-01T00:00:00.000Z' }),
  });
  record('RBAC: DISPATCHER cannot CREATE employee', 'HTTP 403 Forbidden', `HTTP ${dispCreateRes.status}`, dispCreateRes.status === 403);

  // Test 19.5: DRIVER (Non-member) -> Expected: 403
  const driverAccessRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenDriver}`, 'x-company-id': companyA.id },
  });
  record('RBAC: DRIVER (Non-member) blocked from employees', 'HTTP 403 Forbidden', `HTTP ${driverAccessRes.status}`, driverAccessRes.status === 403);

  // Test 19.6: CUSTOMER (Non-member) -> Expected: 403
  const custAccessRes = await fetch(`${API_URL}/employees`, {
    headers: { Authorization: `Bearer ${tokenCustomer}`, 'x-company-id': companyA.id },
  });
  record('RBAC: CUSTOMER (Non-member) blocked from employees', 'HTTP 403 Forbidden', `HTTP ${custAccessRes.status}`, custAccessRes.status === 403);

  // ─── PHASE 22: AUDIT LOG VERIFICATION ──────────────────────────────────────
  console.log('\n--- PHASE 22: Audit Log Verification ---');
  const audits = await prisma.auditLog.findMany({
    where: { entityType: 'Employee' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const hasRequiredFields = audits.every((a: any) => a.entityId && a.action && a.createdAt);
  const noPasswordsInAudit = audits.every((a: any) => {
    const s = JSON.stringify(a.metadata || {});
    return !s.includes('password') && !s.includes('tokenHash');
  });

  record('Audit Log captures required entity fields and timestamps', 'entityId, action, timestamp populated', `Audits checked: ${audits.length}`, hasRequiredFields);
  record('Audit Log does NOT expose passwords or tokens', 'No password/token in metadata', `Sanitized: ${noPasswordsInAudit}`, noPasswordsInAudit);

  // ─── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log('MASTER QA SUITE SUMMARY');
  console.log('============================================================');
  const passed = qaResults.filter(r => r.status === 'PASS').length;
  const failed = qaResults.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${qaResults.length}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('============================================================');

  fs.writeFileSync(
    path.resolve(__dirname, 'qa_results.json'),
    JSON.stringify(qaResults, null, 2),
    'utf-8'
  );

  if (failed > 0) {
    process.exit(1);
  }
}

run()
  .catch((err) => {
    console.error('Fatal QA error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
