-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('MANUAL', 'ONLINE', 'CORPORATE', 'PHONE', 'APP', 'OTHER');

-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('ONE_WAY', 'ROUND_TRIP', 'RENTAL', 'AIRPORT_TRANSFER', 'OUTSTATION');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED', 'DISPATCHED', 'DRIVER_ARRIVED', 'PASSENGER_ONBOARD', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "customerId" UUID,
    "bookingNumber" TEXT NOT NULL,
    "source" "BookingSource" NOT NULL DEFAULT 'MANUAL',
    "tripType" "TripType" NOT NULL DEFAULT 'ONE_WAY',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "pickupLocation" TEXT NOT NULL,
    "pickupAddress" TEXT,
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "dropLocation" TEXT NOT NULL,
    "dropAddress" TEXT,
    "dropLatitude" DOUBLE PRECISION,
    "dropLongitude" DOUBLE PRECISION,
    "scheduledPickupAt" TIMESTAMP(3) NOT NULL,
    "estimatedDurationMinutes" INTEGER,
    "estimatedDistanceKm" DOUBLE PRECISION,
    "passengerCount" INTEGER NOT NULL DEFAULT 1,
    "luggageCount" INTEGER NOT NULL DEFAULT 0,
    "vehicleCategory" TEXT,
    "specialRequirements" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "estimatedFare" DECIMAL(12,2),
    "notes" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "driverId" UUID,
    "vehicleId" UUID,
    "tripNumber" TEXT NOT NULL,
    "pickupLocation" TEXT NOT NULL,
    "pickupAddress" TEXT,
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "dropLocation" TEXT NOT NULL,
    "dropAddress" TEXT,
    "dropLatitude" DOUBLE PRECISION,
    "dropLongitude" DOUBLE PRECISION,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "distanceKm" DOUBLE PRECISION,
    "durationMinutes" INTEGER,
    "passengerCount" INTEGER NOT NULL DEFAULT 1,
    "status" "TripStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancellationReason" TEXT,
    "cancelledBy" UUID,
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_status_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tripId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "fromStatus" "TripStatus",
    "toStatus" "TripStatus" NOT NULL,
    "changedBy" UUID,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_companyId_idx" ON "bookings"("companyId");

-- CreateIndex
CREATE INDEX "bookings_companyId_status_idx" ON "bookings"("companyId", "status");

-- CreateIndex
CREATE INDEX "bookings_scheduledPickupAt_idx" ON "bookings"("scheduledPickupAt");

-- CreateIndex
CREATE INDEX "bookings_customerId_idx" ON "bookings"("customerId");

-- CreateIndex
CREATE INDEX "bookings_deletedAt_idx" ON "bookings"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_companyId_bookingNumber_key" ON "bookings"("companyId", "bookingNumber");

-- CreateIndex
CREATE INDEX "trips_companyId_idx" ON "trips"("companyId");

-- CreateIndex
CREATE INDEX "trips_companyId_status_idx" ON "trips"("companyId", "status");

-- CreateIndex
CREATE INDEX "trips_bookingId_idx" ON "trips"("bookingId");

-- CreateIndex
CREATE INDEX "trips_driverId_idx" ON "trips"("driverId");

-- CreateIndex
CREATE INDEX "trips_vehicleId_idx" ON "trips"("vehicleId");

-- CreateIndex
CREATE INDEX "trips_scheduledStart_idx" ON "trips"("scheduledStart");

-- CreateIndex
CREATE INDEX "trips_deletedAt_idx" ON "trips"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "trips_companyId_tripNumber_key" ON "trips"("companyId", "tripNumber");

-- CreateIndex
CREATE INDEX "trip_status_histories_tripId_idx" ON "trip_status_histories"("tripId");

-- CreateIndex
CREATE INDEX "trip_status_histories_companyId_idx" ON "trip_status_histories"("companyId");

-- CreateIndex
CREATE INDEX "trip_status_histories_createdAt_idx" ON "trip_status_histories"("createdAt");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_status_histories" ADD CONSTRAINT "trip_status_histories_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
