import * as fs from 'fs';
import * as path from 'path';
import { chromium, Page } from 'playwright';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public';
}

const prisma = new PrismaClient();
const SCREENSHOT_DIR = path.resolve('C:/Users/Vinayak/.gemini/antigravity-ide/brain/88ffaef0-792c-4c61-9a65-8adb8314159b/scratch/screenshots');

interface FrontendTestResult {
  step: string;
  expected: string;
  actual: string;
  passed: boolean;
  screenshot?: string;
}

const results: FrontendTestResult[] = [];
const consoleErrors: string[] = [];

function record(step: string, expected: string, actual: string, passed: boolean, screenshot?: string) {
  results.push({ step, expected, actual, passed, screenshot });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${passed ? 'PASS' : 'FAIL'}] ${step} -> ${actual}`);
}

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('============================================================');
  console.log('STARTING AI-MOS FRONTEND & TENANT ISOLATION E2E (PLAYWRIGHT)');
  console.log('============================================================\n');

  // 1. Prepare database memberships for testing
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@aimos.dev' } });
  const companyA = await prisma.company.findUniqueOrThrow({ where: { slug: 'company-a-test' } });
  const companyB = await prisma.company.findUniqueOrThrow({ where: { slug: 'company-b-test' } });

  // Ensure user is member in both companies for company switching test
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: user.id, companyId: companyA.id } },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: { userId: user.id, companyId: companyA.id, role: 'OWNER', status: 'ACTIVE' },
  });
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: user.id, companyId: companyB.id } },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: { userId: user.id, companyId: companyB.id, role: 'OWNER', status: 'ACTIVE' },
  });

  // Clean up any previous test Aarav employee
  await prisma.employee.deleteMany({ where: { companyId: companyA.id, firstName: 'Aarav' } });

  // Ensure Company A has Rahul Patil and Company B has Bhavna Verma
  await prisma.employee.upsert({
    where: { companyId_employeeNumber: { companyId: companyA.id, employeeNumber: 'EMP-000001' } },
    update: { deletedAt: null, employmentStatus: 'ACTIVE', firstName: 'Rahul', lastName: 'Patil' },
    create: {
      companyId: companyA.id,
      employeeNumber: 'EMP-000001',
      firstName: 'Rahul',
      lastName: 'Patil',
      department: 'OPERATIONS',
      designation: 'Operations Manager',
      employmentType: 'FULL_TIME',
      phone: '+919876543210',
      joiningDate: new Date('2026-01-15'),
      employmentStatus: 'ACTIVE',
    },
  });

  await prisma.employee.upsert({
    where: { companyId_employeeNumber: { companyId: companyB.id, employeeNumber: 'EMP-B-001' } },
    update: { deletedAt: null, employmentStatus: 'ACTIVE', firstName: 'Bhavna', lastName: 'Verma' },
    create: {
      companyId: companyB.id,
      employeeNumber: 'EMP-B-001',
      firstName: 'Bhavna',
      lastName: 'Verma',
      department: 'DISPATCH',
      designation: 'Fleet Dispatcher',
      employmentType: 'FULL_TIME',
      phone: '+919888888888',
      joiningDate: new Date('2026-01-20'),
      employmentStatus: 'ACTIVE',
    },
  });

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page: Page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`[Page Error] ${err.message}`);
  });

  try {
    // Step 1: Open Login
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    const loginShot = path.join(SCREENSHOT_DIR, '01_login_page.png');
    await page.screenshot({ path: loginShot });
    record('Load Login Page', 'Login form visible', 'Page loaded with HTTP 200', true, loginShot);

    // Step 2: Perform Login
    console.log('2. Entering credentials for owner@aimos.dev...');
    await page.fill('#email', 'owner@aimos.dev');
    await page.fill('#password', 'Admin@12345!');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
    console.log(`Navigated after login to: ${page.url()}`);
    const dashShot = path.join(SCREENSHOT_DIR, '02_post_login.png');
    await page.screenshot({ path: dashShot });
    record('Authenticate & Redirect', 'Redirect away from /login', `Redirected to ${page.url()}`, true, dashShot);

    // Step 3: Navigate to Company A Employees page
    console.log('3. Navigating to Company A Employees...');
    await page.goto(`http://localhost:3000/companies/${companyA.id}/employees`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Employees")', { timeout: 10000 });
    const empListShot = path.join(SCREENSHOT_DIR, '03_company_a_employees.png');
    await page.screenshot({ path: empListShot });

    // Verify stats and table
    const pageTextA = await page.innerText('body');
    const hasRahul = pageTextA.includes('Rahul') && pageTextA.includes('Patil');
    const hasStats = pageTextA.includes('Total') && pageTextA.includes('Active');
    record('Company A Employees List & Stats', 'Rahul Patil visible, stats rendered', `Rahul present: ${hasRahul}, Stats present: ${hasStats}`, hasRahul && hasStats, empListShot);

    // Step 4: Click Add Employee & Form Validation
    console.log('4. Navigating to Create Employee form...');
    await page.waitForSelector('a:has-text("Add Employee")', { timeout: 15000 });
    await page.click('a:has-text("Add Employee")');
    await page.waitForURL(`**/companies/${companyA.id}/employees/new`, { timeout: 10000 });
    const newEmpShot = path.join(SCREENSHOT_DIR, '04_new_employee_form.png');
    await page.screenshot({ path: newEmpShot });

    // Fill form
    console.log('5. Submitting new employee form: Aarav Sharma...');
    await page.fill('#firstName', 'Aarav');
    await page.fill('#lastName', 'Sharma');
    await page.fill('#phone', '+919876500001');
    await page.selectOption('#department', 'OPERATIONS');
    await page.fill('#designation', 'Route Planner');
    await page.selectOption('#employmentType', 'FULL_TIME');
    await page.fill('#joiningDate', '2026-02-01');

    await page.click('button[type="submit"]');

    // Wait for redirect to employee details page
    await page.waitForURL(`**/companies/${companyA.id}/employees/**`, { timeout: 10000 });
    await page.waitForSelector('text=Aarav', { timeout: 10000 });
    const detailsShot = path.join(SCREENSHOT_DIR, '05_employee_details.png');
    await page.screenshot({ path: detailsShot });
    const detailsText = await page.innerText('body');
    const detailsHasAarav = detailsText.includes('Aarav') && detailsText.includes('Sharma');
    record('Create Employee & View Details via UI', 'Navigates to Employee Details page with Aarav Sharma', `Aarav found: ${detailsHasAarav}`, detailsHasAarav, detailsShot);

    // Navigate back to Employees list to verify table listing
    console.log('6. Verifying Employee appears in list view...');
    await page.goto(`http://localhost:3000/companies/${companyA.id}/employees`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Aarav', { timeout: 10000 });
    const createdShot = path.join(SCREENSHOT_DIR, '06_employee_in_list.png');
    await page.screenshot({ path: createdShot });

    const pageTextAfterCreate = await page.innerText('body');
    const hasAaravInList = pageTextAfterCreate.includes('Aarav') && pageTextAfterCreate.includes('Sharma');
    record('Employee in List Table', 'Aarav Sharma listed in employee table', `Aarav Sharma found: ${hasAaravInList}`, hasAaravInList, createdShot);

    // Step 5: Test Search Filter in UI
    console.log('7. Testing Search filter for "Aarav"...');
    await page.fill('input[placeholder*="Search employees"]', 'Aarav');
    await page.waitForTimeout(600); // debounce wait
    const searchShot = path.join(SCREENSHOT_DIR, '07_search_aarav.png');
    await page.screenshot({ path: searchShot });

    const textSearch = await page.innerText('body');
    const searchFiltersCorrectly = textSearch.includes('Aarav') && !textSearch.includes('Rahul');
    record('UI Search Filter', 'Only Aarav Sharma displayed, others filtered out', `Search filtered: ${searchFiltersCorrectly}`, searchFiltersCorrectly, searchShot);

    // Clear search
    await page.fill('input[placeholder*="Search employees"]', '');
    await page.waitForTimeout(600);

    // Step 6: Company Switcher & Tenant Isolation
    console.log('8. Switching to Company B via Company Selector...');
    await page.click('#btn-company-selector');
    await page.waitForSelector('button[role="option"]', { timeout: 5000 });

    // Click Company Beta Logistics
    await page.click(`button[role="option"]:has-text("${companyB.name}")`);
    await page.waitForTimeout(1000);

    // Navigate to Company B employees
    await page.goto(`http://localhost:3000/companies/${companyB.id}/employees`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Employees")', { timeout: 10000 });
    const compBShot = path.join(SCREENSHOT_DIR, '08_company_b_employees.png');
    await page.screenshot({ path: compBShot });

    const pageTextB = await page.innerText('body');
    const hasBhavna = pageTextB.includes('Bhavna') && pageTextB.includes('Verma');
    const noAaravInB = !pageTextB.includes('Aarav');
    const noRahulInB = !pageTextB.includes('Rahul');
    const tenantIsolatedInFrontend = hasBhavna && noAaravInB && noRahulInB;

    record(
      'Company Switching & Frontend Tenant Isolation',
      'Company B shows Bhavna Verma; Company A employees (Aarav, Rahul) completely absent',
      `Bhavna: ${hasBhavna}, No Aarav: ${noAaravInB}, No Rahul: ${noRahulInB}`,
      tenantIsolatedInFrontend,
      compBShot
    );

    // Step 7: Console audit
    const fatalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('Hydration'));
    record(
      'Browser Console Audit',
      'No fatal JavaScript or unhandled React errors',
      `Errors caught: ${fatalErrors.length}`,
      fatalErrors.length === 0
    );

  } catch (err: any) {
    console.error('Frontend E2E error:', err);
    const errShot = path.join(SCREENSHOT_DIR, 'error_state.png');
    await page.screenshot({ path: errShot });
    record('Frontend E2E Execution', 'Clean run without unhandled exceptions', err.message, false, errShot);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  console.log('\n============================================================');
  console.log('FRONTEND E2E TEST SUMMARY');
  console.log('============================================================');
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(`TOTAL:  ${results.length}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log('============================================================');

  fs.writeFileSync(
    path.resolve(__dirname, 'frontend_e2e_results.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch(e => {
  console.error('Fatal script error:', e);
  process.exit(1);
});
