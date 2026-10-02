-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "action" TEXT,
ADD COLUMN     "module" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "companyId" UUID,
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'COMPANY';

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "roles_scope_idx" ON "roles"("scope");

-- CreateIndex
CREATE INDEX "roles_companyId_idx" ON "roles"("companyId");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
