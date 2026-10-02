-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED', 'ON_TRIP');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleOwnership" AS ENUM ('OWNED', 'LEASED', 'RENTED');

-- CreateEnum
CREATE TYPE "VehicleDocumentType" AS ENUM ('REGISTRATION_CERTIFICATE', 'INSURANCE', 'POLLUTION_CERTIFICATE', 'FITNESS_CERTIFICATE', 'PERMIT', 'TAX_TOKEN', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT,
    "vin" TEXT,
    "fuelType" "FuelType" NOT NULL DEFAULT 'DIESEL',
    "ownership" "VehicleOwnership" NOT NULL DEFAULT 'OWNED',
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "capacity" INTEGER,
    "odometer" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "registrationExpiry" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vehicleId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "documentType" "VehicleDocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_maintenances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vehicleId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "maintenanceType" "MaintenanceType" NOT NULL DEFAULT 'PREVENTIVE',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "description" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "odometerAtService" INTEGER,
    "cost" DECIMAL(12,2),
    "vendor" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_companyId_idx" ON "vehicles"("companyId");

-- CreateIndex
CREATE INDEX "vehicles_companyId_status_idx" ON "vehicles"("companyId", "status");

-- CreateIndex
CREATE INDEX "vehicles_companyId_fuelType_idx" ON "vehicles"("companyId", "fuelType");

-- CreateIndex
CREATE INDEX "vehicles_companyId_createdAt_idx" ON "vehicles"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "vehicles_deletedAt_idx" ON "vehicles"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_companyId_vehicleNumber_key" ON "vehicles"("companyId", "vehicleNumber");

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicleId_idx" ON "vehicle_documents"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_documents_companyId_idx" ON "vehicle_documents"("companyId");

-- CreateIndex
CREATE INDEX "vehicle_documents_expiresAt_idx" ON "vehicle_documents"("expiresAt");

-- CreateIndex
CREATE INDEX "vehicle_maintenances_vehicleId_idx" ON "vehicle_maintenances"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_maintenances_companyId_idx" ON "vehicle_maintenances"("companyId");

-- CreateIndex
CREATE INDEX "vehicle_maintenances_status_idx" ON "vehicle_maintenances"("status");

-- CreateIndex
CREATE INDEX "vehicle_maintenances_scheduledAt_idx" ON "vehicle_maintenances"("scheduledAt");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_maintenances" ADD CONSTRAINT "vehicle_maintenances_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
