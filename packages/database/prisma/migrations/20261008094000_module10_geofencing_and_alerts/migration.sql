-- CreateEnum
CREATE TYPE "GeofenceType" AS ENUM ('CIRCLE', 'POLYGON');

-- CreateEnum
CREATE TYPE "FleetAlertType" AS ENUM ('GEOFENCE_ENTRY', 'GEOFENCE_EXIT', 'OVERSPEED', 'HARSH_BRAKING', 'EXCESSIVE_IDLE');

-- CreateEnum
CREATE TYPE "FleetAlertSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FleetAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "geofences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "GeofenceType" NOT NULL DEFAULT 'CIRCLE',
    "geometry" JSONB NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "entryAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "exitAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofence_vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "geofenceId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geofence_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_alert_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "overspeedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overspeedThresholdKmH" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
    "overspeedGracePeriodSeconds" INTEGER NOT NULL DEFAULT 10,
    "harshBrakingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "harshBrakingThresholdKmhPerSec" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "excessiveIdleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "excessiveIdleThresholdMinutes" INTEGER NOT NULL DEFAULT 15,
    "geofenceEntryAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "geofenceExitAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_alert_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "tripId" UUID,
    "geofenceId" UUID,
    "type" "FleetAlertType" NOT NULL,
    "severity" "FleetAlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "FleetAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" UUID,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" UUID,
    "dismissedAt" TIMESTAMP(3),
    "dismissedBy" UUID,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "geofences_companyId_idx" ON "geofences"("companyId");
CREATE INDEX "geofences_companyId_isActive_idx" ON "geofences"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "geofence_vehicles_geofenceId_vehicleId_key" ON "geofence_vehicles"("geofenceId", "vehicleId");
CREATE INDEX "geofence_vehicles_companyId_idx" ON "geofence_vehicles"("companyId");
CREATE INDEX "geofence_vehicles_vehicleId_idx" ON "geofence_vehicles"("vehicleId");
CREATE INDEX "geofence_vehicles_geofenceId_idx" ON "geofence_vehicles"("geofenceId");

-- CreateIndex
CREATE UNIQUE INDEX "company_alert_configs_companyId_key" ON "company_alert_configs"("companyId");
CREATE INDEX "company_alert_configs_companyId_idx" ON "company_alert_configs"("companyId");

-- CreateIndex
CREATE INDEX "fleet_alerts_companyId_idx" ON "fleet_alerts"("companyId");
CREATE INDEX "fleet_alerts_companyId_status_idx" ON "fleet_alerts"("companyId", "status");
CREATE INDEX "fleet_alerts_companyId_severity_idx" ON "fleet_alerts"("companyId", "severity");
CREATE INDEX "fleet_alerts_companyId_type_idx" ON "fleet_alerts"("companyId", "type");
CREATE INDEX "fleet_alerts_vehicleId_idx" ON "fleet_alerts"("vehicleId");
CREATE INDEX "fleet_alerts_driverId_idx" ON "fleet_alerts"("driverId");
CREATE INDEX "fleet_alerts_geofenceId_idx" ON "fleet_alerts"("geofenceId");
CREATE INDEX "fleet_alerts_triggeredAt_idx" ON "fleet_alerts"("triggeredAt");

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence_vehicles" ADD CONSTRAINT "geofence_vehicles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "geofence_vehicles" ADD CONSTRAINT "geofence_vehicles_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "geofences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "geofence_vehicles" ADD CONSTRAINT "geofence_vehicles_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_alert_configs" ADD CONSTRAINT "company_alert_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_alerts" ADD CONSTRAINT "fleet_alerts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fleet_alerts" ADD CONSTRAINT "fleet_alerts_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fleet_alerts" ADD CONSTRAINT "fleet_alerts_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fleet_alerts" ADD CONSTRAINT "fleet_alerts_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fleet_alerts" ADD CONSTRAINT "fleet_alerts_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "geofences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
