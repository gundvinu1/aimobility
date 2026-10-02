import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DATABASE SCHEMA & DATA INTEGRITY VERIFICATION ---');

  // 1. Table counts
  const users = await prisma.user.count();
  const companies = await prisma.company.count();
  const employees = await prisma.employee.count();
  const roles = await prisma.role.count();
  const permissions = await prisma.permission.count();
  const memberships = await prisma.userCompany.count();
  const auditLogs = await prisma.auditLog.count();

  console.log({
    users,
    companies,
    employees,
    roles,
    permissions,
    memberships,
    auditLogs,
  });

  // 2. Check for orphan employees (companyId not in Company)
  const orphanEmployees = await prisma.$queryRaw<any[]>`
    SELECT e.id, e."companyId", e."employeeNumber"
    FROM "employees" e
    LEFT JOIN "companies" c ON e."companyId" = c.id
    WHERE c.id IS NULL
  `;
  console.log('Orphan Employees Count:', orphanEmployees.length);

  // 3. Check for orphan user links (userId not in User)
  const orphanUserLinks = await prisma.$queryRaw<any[]>`
    SELECT e.id, e."userId"
    FROM "employees" e
    LEFT JOIN "users" u ON e."userId" = u.id
    WHERE e."userId" IS NOT NULL AND u.id IS NULL
  `;
  console.log('Orphan User Links Count:', orphanUserLinks.length);

  // 4. Check unique constraint on (companyId, employeeNumber)
  const duplicateEmpNums = await prisma.$queryRaw<any[]>`
    SELECT "companyId", "employeeNumber", COUNT(*) as count
    FROM "employees"
    GROUP BY "companyId", "employeeNumber"
    HAVING COUNT(*) > 1
  `;
  console.log('Duplicate (companyId, employeeNumber) violations:', duplicateEmpNums.length);

  // 5. Check foreign keys and indexes on employees table
  const indices = await prisma.$queryRaw<any[]>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'employees'
  `;
  console.log('Indexes on employees:', indices.map(i => i.indexname));

  const fks = await prisma.$queryRaw<any[]>`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'employees' AND tc.constraint_type = 'FOREIGN KEY'
  `;
  console.log('Foreign keys on employees:', fks.map(f => `${f.column_name} -> ${f.foreign_table_name}.${f.foreign_column_name} (ON DELETE ${f.delete_rule})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
