-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "DriverDutyStatus" AS ENUM ('OFF_DUTY', 'ON_DUTY', 'ON_TRIP', 'ON_BREAK', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('LMV', 'HMV', 'COMMERCIAL', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DriverDocumentType" AS ENUM ('DRIVING_LICENSE', 'BADGE', 'POLICE_VERIFICATION', 'MEDICAL_CERTIFICATE', 'IDENTITY_PROOF', 'ADDRESS_PROOF', 'OTHER');

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "employeeId" UUID,
    "driverCode" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL DEFAULT 'COMMERCIAL',
    "licenseIssueDate" TIMESTAMP(3),
    "licenseExpiryDate" TIMESTAMP(3) NOT NULL,
    "licenseIssuingAuthority" TEXT,
    "badgeNumber" TEXT,
    "badgeExpiryDate" TIMESTAMP(3),
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "bloodGroup" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "dutyStatus" "DriverDutyStatus" NOT NULL DEFAULT 'OFF_DUTY',
    "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driverId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "documentType" "DriverDocumentType" NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_duty_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driverId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "status" "DriverDutyStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_duty_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_vehicle_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_vehicle_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drivers_employeeId_key" ON "drivers"("employeeId");

-- CreateIndex
CREATE INDEX "drivers_companyId_idx" ON "drivers"("companyId");

-- CreateIndex
CREATE INDEX "drivers_companyId_status_idx" ON "drivers"("companyId", "status");

-- CreateIndex
CREATE INDEX "drivers_companyId_dutyStatus_idx" ON "drivers"("companyId", "dutyStatus");

-- CreateIndex
CREATE INDEX "drivers_licenseExpiryDate_idx" ON "drivers"("licenseExpiryDate");

-- CreateIndex
CREATE INDEX "drivers_employeeId_idx" ON "drivers"("employeeId");

-- CreateIndex
CREATE INDEX "drivers_deletedAt_idx" ON "drivers"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_companyId_driverCode_key" ON "drivers"("companyId", "driverCode");

-- CreateIndex
CREATE INDEX "driver_documents_driverId_idx" ON "driver_documents"("driverId");

-- CreateIndex
CREATE INDEX "driver_documents_companyId_idx" ON "driver_documents"("companyId");

-- CreateIndex
CREATE INDEX "driver_documents_expiryDate_idx" ON "driver_documents"("expiryDate");

-- CreateIndex
CREATE INDEX "driver_documents_deletedAt_idx" ON "driver_documents"("deletedAt");

-- CreateIndex
CREATE INDEX "driver_duty_logs_driverId_idx" ON "driver_duty_logs"("driverId");

-- CreateIndex
CREATE INDEX "driver_duty_logs_companyId_idx" ON "driver_duty_logs"("companyId");

-- CreateIndex
CREATE INDEX "driver_duty_logs_startedAt_idx" ON "driver_duty_logs"("startedAt");

-- CreateIndex
CREATE INDEX "driver_vehicle_assignments_companyId_idx" ON "driver_vehicle_assignments"("companyId");

-- CreateIndex
CREATE INDEX "driver_vehicle_assignments_driverId_idx" ON "driver_vehicle_assignments"("driverId");

-- CreateIndex
CREATE INDEX "driver_vehicle_assignments_vehicleId_idx" ON "driver_vehicle_assignments"("vehicleId");

-- CreateIndex
CREATE INDEX "driver_vehicle_assignments_isActive_idx" ON "driver_vehicle_assignments"("isActive");

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_duty_logs" ADD CONSTRAINT "driver_duty_logs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_vehicle_assignments" ADD CONSTRAINT "driver_vehicle_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_vehicle_assignments" ADD CONSTRAINT "driver_vehicle_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
