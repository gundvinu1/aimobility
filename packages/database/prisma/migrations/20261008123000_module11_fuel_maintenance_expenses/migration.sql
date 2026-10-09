-- AlterEnum
ALTER TYPE "FleetAlertType" ADD VALUE 'FUEL_DROP';
ALTER TYPE "FleetAlertType" ADD VALUE 'MAINTENANCE_DUE';

-- AlterTable
ALTER TABLE "company_alert_configs" ADD COLUMN "fuelDropEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "company_alert_configs" ADD COLUMN "fuelDropThresholdLiters" DOUBLE PRECISION NOT NULL DEFAULT 10.0;
ALTER TABLE "company_alert_configs" ADD COLUMN "maintenanceAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum
CREATE TYPE "FuelTransactionSource" AS ENUM ('MANUAL', 'TELEMATICS', 'FUEL_CARD', 'IMPORT');

-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('SERVICE_CENTER', 'MECHANIC', 'FUEL_STATION', 'PARTS_SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderItemType" AS ENUM ('PARTS', 'LABOR', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorInvoiceStatus" AS ENUM ('DRAFT', 'RECEIVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VehicleExpenseCategory" AS ENUM ('FUEL', 'MAINTENANCE', 'REPAIR', 'PARTS', 'INSURANCE', 'TAX', 'TOLL', 'PARKING', 'CLEANING', 'OTHER');

-- CreateTable
CREATE TABLE "fuel_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "tripId" UUID,
    "vendorId" UUID,
    "fuelType" "FuelType" NOT NULL DEFAULT 'DIESEL',
    "quantityLiters" DOUBLE PRECISION NOT NULL,
    "pricePerLiter" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "odometer" INTEGER,
    "fuelLevelBefore" DOUBLE PRECISION,
    "fuelLevelAfter" DOUBLE PRECISION,
    "transactionSource" "FuelTransactionSource" NOT NULL DEFAULT 'MANUAL',
    "reference" TEXT,
    "stationName" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "serviceType" TEXT NOT NULL,
    "description" TEXT,
    "intervalKm" INTEGER,
    "intervalDays" INTEGER,
    "lastServiceOdometer" INTEGER,
    "lastServiceDate" TIMESTAMP(3),
    "nextDueOdometer" INTEGER,
    "nextDueDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "scheduleId" UUID,
    "workOrderId" UUID,
    "vendorId" UUID,
    "serviceType" TEXT NOT NULL,
    "odometer" INTEGER,
    "serviceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laborCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "notes" TEXT,
    "reference" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VendorType" NOT NULL DEFAULT 'SERVICE_CENTER',
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "vendorId" UUID,
    "scheduleId" UUID,
    "workOrderNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "assignedTechnician" TEXT,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "itemType" "WorkOrderItemType" NOT NULL DEFAULT 'PARTS',
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "vehicleId" UUID,
    "workOrderId" UUID,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "VendorInvoiceStatus" NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "tripId" UUID,
    "vendorId" UUID,
    "fuelTransactionId" UUID,
    "maintenanceRecordId" UUID,
    "category" "VehicleExpenseCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fuel_transactions_companyId_idx" ON "fuel_transactions"("companyId");
CREATE INDEX "fuel_transactions_companyId_transactionDate_idx" ON "fuel_transactions"("companyId", "transactionDate");
CREATE INDEX "fuel_transactions_companyId_vehicleId_idx" ON "fuel_transactions"("companyId", "vehicleId");
CREATE INDEX "fuel_transactions_vehicleId_idx" ON "fuel_transactions"("vehicleId");
CREATE INDEX "fuel_transactions_driverId_idx" ON "fuel_transactions"("driverId");
CREATE INDEX "fuel_transactions_tripId_idx" ON "fuel_transactions"("tripId");
CREATE INDEX "fuel_transactions_vendorId_idx" ON "fuel_transactions"("vendorId");

-- CreateIndex
CREATE INDEX "maintenance_schedules_companyId_idx" ON "maintenance_schedules"("companyId");
CREATE INDEX "maintenance_schedules_companyId_vehicleId_idx" ON "maintenance_schedules"("companyId", "vehicleId");
CREATE INDEX "maintenance_schedules_companyId_isActive_idx" ON "maintenance_schedules"("companyId", "isActive");
CREATE INDEX "maintenance_schedules_vehicleId_idx" ON "maintenance_schedules"("vehicleId");
CREATE INDEX "maintenance_schedules_nextDueDate_idx" ON "maintenance_schedules"("nextDueDate");

-- CreateIndex
CREATE INDEX "maintenance_records_companyId_idx" ON "maintenance_records"("companyId");
CREATE INDEX "maintenance_records_companyId_serviceDate_idx" ON "maintenance_records"("companyId", "serviceDate");
CREATE INDEX "maintenance_records_vehicleId_idx" ON "maintenance_records"("vehicleId");
CREATE INDEX "maintenance_records_scheduleId_idx" ON "maintenance_records"("scheduleId");
CREATE INDEX "maintenance_records_workOrderId_idx" ON "maintenance_records"("workOrderId");
CREATE INDEX "maintenance_records_vendorId_idx" ON "maintenance_records"("vendorId");

-- CreateIndex
CREATE INDEX "vendors_companyId_idx" ON "vendors"("companyId");
CREATE INDEX "vendors_companyId_isActive_idx" ON "vendors"("companyId", "isActive");
CREATE INDEX "vendors_companyId_type_idx" ON "vendors"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_companyId_workOrderNumber_key" ON "work_orders"("companyId", "workOrderNumber");
CREATE INDEX "work_orders_companyId_idx" ON "work_orders"("companyId");
CREATE INDEX "work_orders_companyId_status_idx" ON "work_orders"("companyId", "status");
CREATE INDEX "work_orders_companyId_priority_idx" ON "work_orders"("companyId", "priority");
CREATE INDEX "work_orders_vehicleId_idx" ON "work_orders"("vehicleId");
CREATE INDEX "work_orders_vendorId_idx" ON "work_orders"("vendorId");

-- CreateIndex
CREATE INDEX "work_order_items_companyId_idx" ON "work_order_items"("companyId");
CREATE INDEX "work_order_items_workOrderId_idx" ON "work_order_items"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_invoices_companyId_vendorId_invoiceNumber_key" ON "vendor_invoices"("companyId", "vendorId", "invoiceNumber");
CREATE INDEX "vendor_invoices_companyId_idx" ON "vendor_invoices"("companyId");
CREATE INDEX "vendor_invoices_companyId_status_idx" ON "vendor_invoices"("companyId", "status");
CREATE INDEX "vendor_invoices_vendorId_idx" ON "vendor_invoices"("vendorId");
CREATE INDEX "vendor_invoices_vehicleId_idx" ON "vendor_invoices"("vehicleId");
CREATE INDEX "vendor_invoices_workOrderId_idx" ON "vendor_invoices"("workOrderId");

-- CreateIndex
CREATE INDEX "vehicle_expenses_companyId_idx" ON "vehicle_expenses"("companyId");
CREATE INDEX "vehicle_expenses_companyId_date_idx" ON "vehicle_expenses"("companyId", "date");
CREATE INDEX "vehicle_expenses_companyId_category_idx" ON "vehicle_expenses"("companyId", "category");
CREATE INDEX "vehicle_expenses_vehicleId_idx" ON "vehicle_expenses"("vehicleId");
CREATE INDEX "vehicle_expenses_driverId_idx" ON "vehicle_expenses"("driverId");
CREATE INDEX "vehicle_expenses_tripId_idx" ON "vehicle_expenses"("tripId");
CREATE INDEX "vehicle_expenses_vendorId_idx" ON "vehicle_expenses"("vendorId");

-- AddForeignKey
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "maintenance_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "maintenance_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_expenses" ADD CONSTRAINT "vehicle_expenses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_expenses" ADD CONSTRAINT "vehicle_expenses_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_expenses" ADD CONSTRAINT "vehicle_expenses_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_expenses" ADD CONSTRAINT "vehicle_expenses_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_expenses" ADD CONSTRAINT "vehicle_expenses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
