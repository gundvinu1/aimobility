import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000/api/v1';

async function login(email: string, password = 'Admin@12345!'): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as any;
  return data.tokens?.accessToken || data.data?.tokens?.accessToken || data.data?.accessToken;
}

async function runRegression() {
  console.log('--- RUNNING MODULES 1-3 REGRESSION CHECKS ---');
  let pass = 0;
  let fail = 0;

  function assert(name: string, ok: boolean, detail?: string) {
    if (ok) {
      console.log(`✅ [PASS] ${name}${detail ? ` (${detail})` : ''}`);
      pass++;
    } else {
      console.error(`❌ [FAIL] ${name}${detail ? ` (${detail})` : ''}`);
      fail++;
    }
  }

  // 1. Health
  const liveRes = await fetch(`${API_URL}/health/live`);
  assert('Health live returns 200', liveRes.status === 200, `status: ${liveRes.status}`);

  const readyRes = await fetch(`${API_URL}/health/ready`);
  assert('Health ready returns 200', readyRes.status === 200, `status: ${readyRes.status}`);

  // 2. Authentication & /me
  const token = await login('owner@aimos.dev');
  assert('Login returns access token', !!token);

  const meRes = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meJson = (await meRes.json()) as any;
  const me = meJson.data || meJson;
  assert('GET /auth/me returns current user', meRes.status === 200 && me.email === 'owner@aimos.dev', `email: ${me.email}`);

  // 3. Companies list (Module 3)
  const compRes = await fetch(`${API_URL}/companies`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const compJson = (await compRes.json()) as any;
  const companies = (compJson.data || compJson) as any[];
  assert('GET /companies returns user company memberships', compRes.status === 200 && Array.isArray(companies) && companies.length > 0, `count: ${companies.length}`);

  const companyA = companies[0];

  // 4. Company details
  const compDetailRes = await fetch(`${API_URL}/companies/${companyA.id}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-company-id': companyA.id },
  });
  const compDetail = (await compDetailRes.json()) as any;
  assert('GET /companies/:id returns company details', compDetailRes.status === 200 && (compDetail.data?.id || compDetail.id) === companyA.id);

  // 5. Company members
  const membersRes = await fetch(`${API_URL}/companies/${companyA.id}/members`, {
    headers: { Authorization: `Bearer ${token}`, 'x-company-id': companyA.id },
  });
  assert('GET /companies/:id/members returns members list', membersRes.status === 200);

  // 6. Company settings
  const settingsRes = await fetch(`${API_URL}/companies/${companyA.id}/settings`, {
    headers: { Authorization: `Bearer ${token}`, 'x-company-id': companyA.id },
  });
  assert('GET /companies/:id/settings returns settings', settingsRes.status === 200);

  console.log(`\nRegression results: ${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

runRegression()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
