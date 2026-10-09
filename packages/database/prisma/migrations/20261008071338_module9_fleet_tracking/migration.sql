-- CreateEnum
CREATE TYPE "TelemetrySource" AS ENUM ('MANUAL', 'MOBILE', 'GPS_DEVICE', 'IOT', 'SIMULATOR', 'API');

-- CreateTable
CREATE TABLE "vehicle_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "ignition" BOOLEAN NOT NULL DEFAULT false,
    "batteryLevel" DOUBLE PRECISION,
    "odometer" INTEGER,
    "engineTemperature" DOUBLE PRECISION,
    "fuelLevel" DOUBLE PRECISION,
    "signalStrength" INTEGER,
    "source" "TelemetrySource" NOT NULL DEFAULT 'API',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_telemetry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "ignition" BOOLEAN NOT NULL DEFAULT false,
    "batteryLevel" DOUBLE PRECISION,
    "odometer" INTEGER,
    "engineTemperature" DOUBLE PRECISION,
    "fuelLevel" DOUBLE PRECISION,
    "signalStrength" INTEGER,
    "source" "TelemetrySource" NOT NULL DEFAULT 'API',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_locations_vehicleId_key" ON "vehicle_locations"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_locations_companyId_idx" ON "vehicle_locations"("companyId");

-- CreateIndex
CREATE INDEX "vehicle_locations_companyId_vehicleId_idx" ON "vehicle_locations"("companyId", "vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_locations_driverId_idx" ON "vehicle_locations"("driverId");

-- CreateIndex
CREATE INDEX "vehicle_locations_timestamp_idx" ON "vehicle_locations"("timestamp");

-- CreateIndex
CREATE INDEX "vehicle_telemetry_companyId_vehicleId_timestamp_idx" ON "vehicle_telemetry"("companyId", "vehicleId", "timestamp");

-- CreateIndex
CREATE INDEX "vehicle_telemetry_companyId_timestamp_idx" ON "vehicle_telemetry"("companyId", "timestamp");

-- CreateIndex
CREATE INDEX "vehicle_telemetry_vehicleId_timestamp_idx" ON "vehicle_telemetry"("vehicleId", "timestamp");

-- CreateIndex
CREATE INDEX "vehicle_telemetry_driverId_idx" ON "vehicle_telemetry"("driverId");

-- AddForeignKey
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_telemetry" ADD CONSTRAINT "vehicle_telemetry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_telemetry" ADD CONSTRAINT "vehicle_telemetry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_telemetry" ADD CONSTRAINT "vehicle_telemetry_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
