-- CreateEnum
CREATE TYPE "StopType" AS ENUM ('PICKUP', 'WAYPOINT', 'DROPOFF');

-- CreateEnum
CREATE TYPE "StopStatus" AS ENUM ('PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED');

-- AlterTable
ALTER TABLE "trips" ADD COLUMN "routePolyline" TEXT;

-- CreateTable
CREATE TABLE "trip_stops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "stopOrder" INTEGER NOT NULL,
    "stopType" "StopType" NOT NULL DEFAULT 'WAYPOINT',
    "locationName" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "plannedArrival" TIMESTAMP(3),
    "plannedDeparture" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "passengerName" TEXT,
    "passengerPhone" TEXT,
    "notes" TEXT,
    "status" "StopStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_stops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_stops_tripId_stopOrder_key" ON "trip_stops"("tripId", "stopOrder");

-- CreateIndex
CREATE INDEX "trip_stops_companyId_idx" ON "trip_stops"("companyId");

-- CreateIndex
CREATE INDEX "trip_stops_tripId_idx" ON "trip_stops"("tripId");

-- CreateIndex
CREATE INDEX "trip_stops_status_idx" ON "trip_stops"("status");

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
