-- DropIndex
DROP INDEX IF EXISTS "roles_name_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_companyId_key" ON "roles"("name", "companyId");
