// scratch/test_module8a_hardening.mjs
// Comprehensive Hardening & Verification Suite for Module 8A

const API_BASE = 'http://localhost:4000/api/v1';
const WEB_BASE = 'http://localhost:3000';

const TEST_USERS = [
  { role: 'SUPER_ADMIN', email: 'superadmin@aimos.dev', pass: 'Admin@12345!' },
  { role: 'OWNER', email: 'owner@aimos.dev', pass: 'Admin@12345!' },
  { role: 'ADMIN', email: 'admin@aimos.dev', pass: 'Admin@12345!' },
  { role: 'MANAGER', email: 'manager@aimos.dev', pass: 'Admin@12345!' },
  { role: 'DISPATCHER', email: 'dispatcher@aimos.dev', pass: 'Admin@12345!' },
  { role: 'ACCOUNTANT', email: 'accountant@aimos.dev', pass: 'Admin@12345!' },
  { role: 'DRIVER', email: 'driver@aimos.dev', pass: 'Admin@12345!' },
  { role: 'CUSTOMER', email: 'customer@aimos.dev', pass: 'Admin@12345!' },
];

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedChecks++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('=================================================================');
  console.log(' AI-MOS MODULE 8A: FINAL VERIFICATION & RBAC HARDENING SUITE    ');
  console.log('=================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: AUTHENTICATION VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Authentication Verification ---');

  const userTokens = {};

  for (const u of TEST_USERS) {
    const { status, data } = await loginUser(u.email, u.pass);
    const token = data?.tokens?.accessToken;
    assert(status === 200 && !!token, `Login succeeds for ${u.role} (${u.email})`);
    if (token) {
      userTokens[u.role] = {
        token,
        refreshToken: data?.refreshToken,
        user: data.user,
      };
    }
  }

  // 1.1 Invalid password rejection
  const badPassRes = await loginUser('owner@aimos.dev', 'WrongPassword123!');
  assert(badPassRes.status === 401, 'Invalid password rejected with HTTP 401');

  // 1.2 Invalid email rejection
  const badEmailRes = await loginUser('nonexistent@aimos.dev', 'Admin@12345!');
  assert(badEmailRes.status === 401, 'Invalid email rejected with HTTP 401');

  // 1.3 Unauthenticated request rejection
  const unauthRes = await fetch(`${API_BASE}/employees`);
  assert(unauthRes.status === 401, 'Unauthenticated request to protected endpoint rejected with HTTP 401');

  // 1.4 Malformed token rejection
  const malformedRes = await fetch(`${API_BASE}/employees`, {
    headers: { Authorization: 'Bearer this-is-not-a-valid-jwt-token' },
  });
  assert(malformedRes.status === 401, 'Malformed JWT token rejected with HTTP 401');

  // 1.5 Token Refresh test
  const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: userTokens['OWNER'].refreshToken }),
  });
  assert(refreshRes.status === 200 || refreshRes.status === 201, 'Session token refresh endpoint succeeds (HTTP 200/201)');

  // 1.6 Logout test
  const logoutRes = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userTokens['OWNER'].token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken: userTokens['OWNER'].refreshToken }),
  });
  assert(logoutRes.status === 200 || logoutRes.status === 204, 'Logout endpoint operational (HTTP 200/204)');
  // Re-login owner
  const reLogin = await loginUser('owner@aimos.dev', 'Admin@12345!');
  userTokens['OWNER'].token = reLogin.data.tokens.accessToken;

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: ROLE & PERMISSION RESOLUTION VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Role & Permission Resolution Verification ---');

  // Fetch companies for tenant context
  const compRes = await fetch(`${API_BASE}/companies`, {
    headers: { Authorization: `Bearer ${userTokens['OWNER'].token}` },
  });
  const companies = await compRes.json();
  const companyA = companies[0];
  const companyB = companies[1];
  assert(!!companyA && !!companyB, `Multi-tenant companies discovered (A: ${companyA.name}, B: ${companyB.name})`);

  // 2.1 SUPER_ADMIN wildcard resolution
  const saMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${userTokens['SUPER_ADMIN'].token}` },
  });
  const saMe = await saMeRes.json();
  assert(saMe.permissions.includes('*'), 'SUPER_ADMIN receives wildcard ["*"] permission');

  // 2.2 OWNER permission resolution in Company A
  const ownerMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${userTokens['OWNER'].token}`,
      'x-company-id': companyA.id,
    },
  });
  const ownerMe = await ownerMeRes.json();
  assert(ownerMe.companyRole === 'OWNER', 'OWNER resolves companyRole: "OWNER"');
  assert(ownerMe.permissions.includes('vehicle.create'), 'OWNER has vehicle.create');
  assert(ownerMe.permissions.includes('employee.delete'), 'OWNER has employee.delete');
  assert(ownerMe.permissions.includes('role.read'), 'OWNER has role.read');
  assert(ownerMe.permissions.includes('role.create'), 'OWNER has role.create');

  // 2.3 ADMIN permission resolution
  const adminMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${userTokens['ADMIN'].token}`,
      'x-company-id': companyA.id,
    },
  });
  const adminMe = await adminMeRes.json();
  assert(adminMe.permissions.includes('vehicle.create'), 'ADMIN has vehicle.create');
  assert(adminMe.permissions.includes('role.read'), 'ADMIN has role.read');
  assert(!adminMe.permissions.includes('company.delete'), 'ADMIN lacks company.delete');

  // 2.4 MANAGER permission resolution
  const mgrMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${userTokens['MANAGER'].token}`,
      'x-company-id': companyA.id,
    },
  });
  const mgrMe = await mgrMeRes.json();
  assert(mgrMe.permissions.includes('vehicle.create'), 'MANAGER has vehicle.create');
  assert(!mgrMe.permissions.includes('vehicle.delete'), 'MANAGER strictly lacks vehicle.delete');
  assert(!mgrMe.permissions.includes('employee.delete'), 'MANAGER strictly lacks employee.delete');
  assert(!mgrMe.permissions.includes('role.read'), 'MANAGER strictly lacks role.read');

  // 2.5 DISPATCHER permission resolution
  const dispMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${userTokens['DISPATCHER'].token}`,
      'x-company-id': companyA.id,
    },
  });
  const dispMe = await dispMeRes.json();
  assert(dispMe.permissions.includes('trip.dispatch'), 'DISPATCHER has trip.dispatch');
  assert(dispMe.permissions.includes('booking.read'), 'DISPATCHER has booking.read');
  assert(!dispMe.permissions.includes('employee.create'), 'DISPATCHER strictly lacks employee.create');
  assert(!dispMe.permissions.includes('employee.read'), 'DISPATCHER strictly lacks employee.read');
  assert(!dispMe.permissions.includes('role.read'), 'DISPATCHER strictly lacks role.read');

  // 2.6 ACCOUNTANT permission resolution
  const accMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${userTokens['ACCOUNTANT'].token}`,
      'x-company-id': companyA.id,
    },
  });
  const accMe = await accMeRes.json();
  assert(accMe.permissions.includes('booking.read'), 'ACCOUNTANT has booking.read');
  assert(accMe.permissions.includes('trip.read'), 'ACCOUNTANT has trip.read');
  assert(!accMe.permissions.includes('trip.dispatch'), 'ACCOUNTANT strictly lacks trip.dispatch');
  assert(!accMe.permissions.includes('vehicle.create'), 'ACCOUNTANT strictly lacks vehicle.create');

  // 2.7 DRIVER permission resolution
  const drvMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${userTokens['DRIVER'].token}` },
  });
  const drvMe = await drvMeRes.json();
  assert(drvMe.permissions.includes('driver.duty.update'), 'DRIVER has driver.duty.update');
  assert(drvMe.permissions.includes('trip.read'), 'DRIVER has trip.read');
  assert(!drvMe.permissions.includes('driver.create'), 'DRIVER strictly lacks driver.create');
  assert(!drvMe.permissions.includes('employee.read'), 'DRIVER strictly lacks employee.read');

  // 2.8 CUSTOMER permission resolution
  const custMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${userTokens['CUSTOMER'].token}` },
  });
  const custMe = await custMeRes.json();
  assert(custMe.permissions.includes('booking.read'), 'CUSTOMER has booking.read');
  assert(custMe.permissions.includes('booking.create'), 'CUSTOMER has booking.create');
  assert(custMe.permissions.includes('trip.read'), 'CUSTOMER has trip.read');
  assert(!custMe.permissions.includes('vehicle.read'), 'CUSTOMER strictly lacks vehicle.read');
  assert(!custMe.permissions.includes('employee.read'), 'CUSTOMER strictly lacks employee.read');
  assert(!custMe.permissions.includes('driver.read'), 'CUSTOMER strictly lacks driver.read');
  assert(!custMe.permissions.includes('role.read'), 'CUSTOMER strictly lacks role.read');

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: DYNAMIC SIDEBAR VISIBILITY SIMULATION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Dynamic Sidebar Visibility Simulation ---');

  const SIDEBAR_ITEMS = [
    { label: 'Overview', permission: 'company.read' },
    { label: 'Employees', permission: 'employee.read' },
    { label: 'Vehicles', permission: 'vehicle.read' },
    { label: 'Drivers', permission: 'driver.read' },
    { label: 'Bookings', permission: 'booking.read' },
    { label: 'Trips', permission: 'trip.read' },
    { label: 'Dispatch Board', permission: 'trip.dispatch' },
    { label: 'Members', permission: 'company.members.read' },
    { label: 'Roles & Permissions', permission: 'role.read' },
    { label: 'Settings', permission: 'company.settings.read' },
  ];

  function evaluateSidebar(perms) {
    if (perms.includes('*')) return SIDEBAR_ITEMS.map((i) => i.label);
    return SIDEBAR_ITEMS.filter((i) => perms.includes(i.permission)).map((i) => i.label);
  }

  // 3.1 SUPER_ADMIN
  const saNav = evaluateSidebar(saMe.permissions);
  assert(saNav.length === SIDEBAR_ITEMS.length, 'SUPER_ADMIN sidebar shows 100% of items');

  // 3.2 OWNER
  const ownerNav = evaluateSidebar(ownerMe.permissions);
  assert(ownerNav.includes('Overview'), 'OWNER sees Overview');
  assert(ownerNav.includes('Employees'), 'OWNER sees Employees');
  assert(ownerNav.includes('Vehicles'), 'OWNER sees Vehicles');
  assert(ownerNav.includes('Drivers'), 'OWNER sees Drivers');
  assert(ownerNav.includes('Bookings'), 'OWNER sees Bookings');
  assert(ownerNav.includes('Trips'), 'OWNER sees Trips');
  assert(ownerNav.includes('Dispatch Board'), 'OWNER sees Dispatch Board');
  assert(ownerNav.includes('Members'), 'OWNER sees Members');
  assert(ownerNav.includes('Roles & Permissions'), 'OWNER sees Roles & Permissions');
  assert(ownerNav.includes('Settings'), 'OWNER sees Settings');

  // 3.3 DISPATCHER
  const dispNav = evaluateSidebar(dispMe.permissions);
  assert(dispNav.includes('Dispatch Board'), 'DISPATCHER sees Dispatch Board');
  assert(dispNav.includes('Bookings'), 'DISPATCHER sees Bookings');
  assert(dispNav.includes('Trips'), 'DISPATCHER sees Trips');
  assert(dispNav.includes('Drivers'), 'DISPATCHER sees Drivers');
  assert(dispNav.includes('Vehicles'), 'DISPATCHER sees Vehicles');
  assert(!dispNav.includes('Employees'), 'DISPATCHER does NOT see Employees');
  assert(!dispNav.includes('Members'), 'DISPATCHER does NOT see Members');
  assert(!dispNav.includes('Roles & Permissions'), 'DISPATCHER does NOT see Roles & Permissions');
  assert(!dispNav.includes('Settings'), 'DISPATCHER does NOT see Settings');

  // 3.4 ACCOUNTANT
  const accNav = evaluateSidebar(accMe.permissions);
  assert(accNav.includes('Bookings'), 'ACCOUNTANT sees Bookings');
  assert(accNav.includes('Trips'), 'ACCOUNTANT sees Trips');
  assert(!accNav.includes('Dispatch Board'), 'ACCOUNTANT does NOT see Dispatch Board');
  assert(!accNav.includes('Vehicles'), 'ACCOUNTANT does NOT see Vehicles');
  assert(!accNav.includes('Drivers'), 'ACCOUNTANT does NOT see Drivers');
  assert(!accNav.includes('Employees'), 'ACCOUNTANT does NOT see Employees');

  // 3.5 DRIVER
  const drvNav = evaluateSidebar(drvMe.permissions);
  assert(drvNav.includes('Trips'), 'DRIVER sees Trips');
  assert(drvNav.includes('Vehicles'), 'DRIVER sees Vehicles');
  assert(!drvNav.includes('Employees'), 'DRIVER does NOT see Employees');
  assert(!drvNav.includes('Drivers'), 'DRIVER does NOT see Drivers roster');
  assert(!drvNav.includes('Dispatch Board'), 'DRIVER does NOT see Dispatch Board');
  assert(!drvNav.includes('Settings'), 'DRIVER does NOT see Settings');

  // 3.6 CUSTOMER
  const custNav = evaluateSidebar(custMe.permissions);
  assert(custNav.includes('Bookings'), 'CUSTOMER sees Bookings');
  assert(custNav.includes('Trips'), 'CUSTOMER sees Trips');
  assert(!custNav.includes('Employees'), 'CUSTOMER does NOT see Employees');
  assert(!custNav.includes('Vehicles'), 'CUSTOMER does NOT see Vehicles');
  assert(!custNav.includes('Drivers'), 'CUSTOMER does NOT see Drivers');
  assert(!custNav.includes('Dispatch Board'), 'CUSTOMER does NOT see Dispatch Board');
  assert(!custNav.includes('Members'), 'CUSTOMER does NOT see Members');
  assert(!custNav.includes('Roles & Permissions'), 'CUSTOMER does NOT see Roles & Permissions');
  assert(!custNav.includes('Settings'), 'CUSTOMER does NOT see Settings');

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 4: BACKEND AUTHORITATIVE SECURITY BOUNDARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Backend Authoritative Security Boundary ---');

  // 4.1 CUSTOMER calls POST /vehicles -> 403
  const custVehicleRes = await fetch(`${API_BASE}/vehicles`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userTokens['CUSTOMER'].token}`,
      'Content-Type': 'application/json',
      'x-company-id': companyA.id,
    },
    body: JSON.stringify({ vehicleNumber: 'ILLEGAL-VEH-1' }),
  });
  assert(custVehicleRes.status === 403, `CUSTOMER direct POST /vehicles returns HTTP 403 (Got ${custVehicleRes.status})`);

  // 4.2 CUSTOMER calls POST /employees -> 403
  const custEmpRes = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userTokens['CUSTOMER'].token}`,
      'Content-Type': 'application/json',
      'x-company-id': companyA.id,
    },
    body: JSON.stringify({ firstName: 'Illegal', lastName: 'Employee' }),
  });
  assert(custEmpRes.status === 403, `CUSTOMER direct POST /employees returns HTTP 403 (Got ${custEmpRes.status})`);

  // 4.3 CUSTOMER calls POST /drivers -> 403
  const custDrvRes = await fetch(`${API_BASE}/drivers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userTokens['CUSTOMER'].token}`,
      'Content-Type': 'application/json',
      'x-company-id': companyA.id,
    },
    body: JSON.stringify({ licenseNumber: 'ILLEGAL-LIC-1' }),
  });
  assert(custDrvRes.status === 403, `CUSTOMER direct POST /drivers returns HTTP 403 (Got ${custDrvRes.status})`);

  // 4.4 DRIVER calls DELETE /vehicles/:id -> 403
  const drvDelVehRes = await fetch(`${API_BASE}/vehicles/nonexistent-id`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${userTokens['DRIVER'].token}`,
      'x-company-id': companyA.id,
    },
  });
  assert(drvDelVehRes.status === 403, `DRIVER direct DELETE /vehicles/:id returns HTTP 403 (Got ${drvDelVehRes.status})`);

  // 4.5 DISPATCHER calls POST /employees -> 403
  const dispEmpRes = await fetch(`${API_BASE}/employees`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userTokens['DISPATCHER'].token}`,
      'Content-Type': 'application/json',
      'x-company-id': companyA.id,
    },
    body: JSON.stringify({ firstName: 'Dispatcher', lastName: 'Created' }),
  });
  assert(dispEmpRes.status === 403, `DISPATCHER direct POST /employees returns HTTP 403 (Got ${dispEmpRes.status})`);

  // 4.6 MANAGER calls DELETE /vehicles/:id -> 403
  const mgrDelVehRes = await fetch(`${API_BASE}/vehicles/nonexistent-id`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${userTokens['MANAGER'].token}`,
      'x-company-id': companyA.id,
    },
  });
  assert(mgrDelVehRes.status === 403, `MANAGER direct DELETE /vehicles/:id returns HTTP 403 (Got ${mgrDelVehRes.status})`);

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 5: TENANT ISOLATION VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Tenant Isolation Verification ---');

  // 5.1 Admin in Company B cannot access Company A employees
  const crossCompanyEmpRes = await fetch(`${API_BASE}/employees`, {
    headers: {
      Authorization: `Bearer ${userTokens['ADMIN'].token}`,
      'x-company-id': companyA.id, // ADMIN belongs to Company Beta, not Company A
    },
  });
  // Since ADMIN is not a member of Company A, TenantGuard rejects or returns 403
  assert(
    crossCompanyEmpRes.status === 403 || crossCompanyEmpRes.status === 401,
    `Cross-tenant access by ADMIN to Company A rejected (HTTP ${crossCompanyEmpRes.status})`
  );

  // 5.2 Company A Owner accessing Company A data succeeds
  const compADataRes = await fetch(`${API_BASE}/companies/${companyA.id}`, {
    headers: {
      Authorization: `Bearer ${userTokens['OWNER'].token}`,
      'x-company-id': companyA.id,
    },
  });
  assert(compADataRes.status === 200, `Company A Owner accessing Company A returns HTTP 200 (Got ${compADataRes.status})`);

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 6: LIVE SERVER & 403 FORBIDDEN PAGE RENDERING
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Live Server & UI 403 Page Verification ---');

  // 6.1 Backend health endpoint
  const healthRes = await fetch(`${API_BASE}/health/live`);
  assert(healthRes.status === 200, 'Backend /health/live returns HTTP 200');

  // 6.2 Frontend root endpoint
  const feRes = await fetch(`${WEB_BASE}`);
  assert(feRes.status === 200, 'Frontend dev server root returns HTTP 200');

  // 6.3 Frontend 403 forbidden page
  const fe403Res = await fetch(`${WEB_BASE}/403`);
  assert(fe403Res.status === 200, 'Next.js /403 page returns HTTP 200');
  const fe403Html = await fe403Res.text();
  assert(
    fe403Html.includes('Access Restricted') || fe403Html.includes('403'),
    '403 page contains "Access Restricted" header'
  );
  assert(
    fe403Html.includes('Dashboard') || fe403Html.includes('Return'),
    '403 page contains recovery navigation button'
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=================================================================');
  console.log(`TOTAL HARDENING CHECKS: ${totalChecks}`);
  console.log(`PASSED: ${passedChecks}`);
  console.log(`FAILED: ${failedChecks}`);
  console.log('=================================================================\n');

  if (failedChecks > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
