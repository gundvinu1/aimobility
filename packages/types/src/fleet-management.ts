// =============================================================================
// AI-MOS Shared Types — Module 11: Fuel, Maintenance, Work Orders & Costs
// =============================================================================

import type { UUID } from './common';
import type { FuelType } from './vehicle';

export type FuelTransactionSource = 'MANUAL' | 'TELEMATICS' | 'FUEL_CARD' | 'IMPORT';

export type VendorType =
  | 'SERVICE_CENTER'
  | 'MECHANIC'
  | 'FUEL_STATION'
  | 'PARTS_SUPPLIER'
  | 'OTHER';

export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type WorkOrderStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type WorkOrderItemType = 'PARTS' | 'LABOR' | 'OTHER';

export type VendorInvoiceStatus = 'DRAFT' | 'RECEIVED' | 'PAID' | 'CANCELLED';

export type VehicleExpenseCategory =
  | 'FUEL'
  | 'MAINTENANCE'
  | 'REPAIR'
  | 'PARTS'
  | 'INSURANCE'
  | 'TAX'
  | 'TOLL'
  | 'PARKING'
  | 'CLEANING'
  | 'OTHER';

export type MaintenanceDueStatus = 'UPCOMING' | 'DUE_SOON' | 'DUE' | 'OVERDUE' | 'COMPLETED';

// ─── Domain A: Fuel Management ────────────────────────────────────────────────

export interface FuelTransactionDto {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  vehicleNumber?: string;
  driverId?: UUID | null;
  driverName?: string | null;
  tripId?: UUID | null;
  tripNumber?: string | null;
  vendorId?: UUID | null;
  vendorName?: string | null;
  fuelType: FuelType;
  quantityLiters: number;
  pricePerLiter: number;
  totalAmount: number;
  odometer?: number | null;
  fuelLevelBefore?: number | null;
  fuelLevelAfter?: number | null;
  transactionSource: FuelTransactionSource;
  reference?: string | null;
  stationName?: string | null;
  transactionDate: string;
  notes?: string | null;
  createdBy?: UUID | null;
  createdAt: string;
  updatedAt: string;
}

export interface FuelAnalyticsDto {
  totalFuelConsumed: number;
  totalFuelCost: number;
  avgPricePerLiter: number;
  avgKmPerLiter: number;
  avgLitersPer100Km: number;
  fuelCostPerKm: number;
  totalDistanceKm: number;
  transactionCount: number;
}

// ─── Domain B: Preventive Maintenance ─────────────────────────────────────────

export interface MaintenanceScheduleDto {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  vehicleNumber?: string;
  serviceType: string;
  description?: string | null;
  intervalKm?: number | null;
  intervalDays?: number | null;
  lastServiceOdometer?: number | null;
  lastServiceDate?: string | null;
  nextDueOdometer?: number | null;
  nextDueDate?: string | null;
  isActive: boolean;
  dueStatus: MaintenanceDueStatus;
  currentOdometer?: number;
  createdBy?: UUID | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceRecordDto {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  vehicleNumber?: string;
  scheduleId?: UUID | null;
  workOrderId?: UUID | null;
  vendorId?: UUID | null;
  vendorName?: string | null;
  serviceType: string;
  odometer?: number | null;
  serviceDate: string;
  partsCost: number;
  laborCost: number;
  tax: number;
  totalCost: number;
  description?: string | null;
  notes?: string | null;
  reference?: string | null;
  createdBy?: UUID | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Domain C: Work Orders & Vendors ──────────────────────────────────────────

export interface VendorDto {
  id: UUID;
  companyId: UUID;
  name: string;
  type: VendorType;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxId?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdBy?: UUID | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderItemDto {
  id: UUID;
  companyId: UUID;
  workOrderId: UUID;
  itemType: WorkOrderItemType;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderDto {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  vehicleNumber?: string;
  vendorId?: UUID | null;
  vendorName?: string | null;
  scheduleId?: UUID | null;
  workOrderNumber: string;
  title: string;
  description?: string | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTechnician?: string | null;
  estimatedCost: number;
  actualCost: number;
  openedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  items?: WorkOrderItemDto[];
  createdBy?: UUID | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorInvoiceDto {
  id: UUID;
  companyId: UUID;
  vendorId: UUID;
  vendorName?: string;
  vehicleId?: UUID | null;
  vehicleNumber?: string | null;
  workOrderId?: UUID | null;
  invoiceNumber: string;
  invoiceDate: string;
  subtotal: number;
  tax: number;
  total: number;
  status: VendorInvoiceStatus;
  notes?: string | null;
  createdBy?: UUID | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Domain D: Vehicle Expenses & TCO Analytics ───────────────────────────────

export interface VehicleExpenseDto {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  vehicleNumber?: string;
  driverId?: UUID | null;
  driverName?: string | null;
  tripId?: UUID | null;
  tripNumber?: string | null;
  vendorId?: UUID | null;
  vendorName?: string | null;
  fuelTransactionId?: UUID | null;
  maintenanceRecordId?: UUID | null;
  category: VehicleExpenseCategory;
  amount: number;
  date: string;
  reference?: string | null;
  description?: string | null;
  source: string;
  createdBy?: UUID | null;
  createdAt: string;
  updatedAt: string;
}

export interface FleetCostSummaryDto {
  totalOperatingCost: number;
  fuelCost: number;
  maintenanceCost: number;
  repairCost: number;
  otherCost: number;
  totalDistanceKm: number;
  costPerKm: number;
  vehicleCount: number;
}

export interface VehicleCostSummaryDto {
  vehicleId: UUID;
  vehicleNumber: string;
  make?: string;
  model?: string;
  totalOperatingCost: number;
  fuelCost: number;
  maintenanceCost: number;
  repairCost: number;
  otherCost: number;
  distanceKm: number;
  costPerKm: number;
}

export interface CategoryCostSummaryDto {
  category: VehicleExpenseCategory;
  totalAmount: number;
  percentage: number;
  count: number;
}

export interface CostTrendDto {
  period: string;
  fuelCost: number;
  maintenanceCost: number;
  repairCost: number;
  otherCost: number;
  totalCost: number;
}

// ─── Input & Query DTO Interfaces ────────────────────────────────────────────

export interface CreateFuelTransactionDto {
  vehicleId: UUID;
  driverId?: UUID;
  tripId?: UUID;
  vendorId?: UUID;
  fuelType?: FuelType;
  quantityLiters: number;
  pricePerLiter: number;
  totalAmount?: number;
  odometer?: number;
  fuelLevelBefore?: number;
  fuelLevelAfter?: number;
  transactionSource?: FuelTransactionSource;
  reference?: string;
  stationName?: string;
  transactionDate?: string;
  notes?: string;
}

export interface UpdateFuelTransactionDto extends Partial<CreateFuelTransactionDto> {}

export interface QueryFuelTransactionsDto {
  vehicleId?: UUID;
  driverId?: UUID;
  startDate?: string;
  endDate?: string;
  fuelType?: FuelType;
  page?: number;
  limit?: number;
}

export interface CreateMaintenanceScheduleDto {
  vehicleId: UUID;
  serviceType: string;
  description?: string;
  intervalKm?: number;
  intervalDays?: number;
  lastServiceOdometer?: number;
  lastServiceDate?: string;
  nextDueOdometer?: number;
  nextDueDate?: string;
  isActive?: boolean;
}

export interface UpdateMaintenanceScheduleDto extends Partial<CreateMaintenanceScheduleDto> {}

export interface QueryMaintenanceSchedulesDto {
  vehicleId?: UUID;
  dueStatus?: MaintenanceDueStatus;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateMaintenanceRecordDto {
  vehicleId: UUID;
  scheduleId?: UUID;
  workOrderId?: UUID;
  vendorId?: UUID;
  serviceType: string;
  odometer?: number;
  serviceDate?: string;
  partsCost?: number;
  laborCost?: number;
  tax?: number;
  totalCost?: number;
  description?: string;
  notes?: string;
  reference?: string;
}

export interface QueryMaintenanceRecordsDto {
  vehicleId?: UUID;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateWorkOrderItemDto {
  itemType?: WorkOrderItemType;
  description: string;
  quantity: number;
  unitCost: number;
}

export interface CreateWorkOrderDto {
  vehicleId: UUID;
  vendorId?: UUID;
  scheduleId?: UUID;
  title: string;
  description?: string;
  priority?: WorkOrderPriority;
  assignedTechnician?: string;
  estimatedCost?: number;
  notes?: string;
  items?: CreateWorkOrderItemDto[];
}

export interface UpdateWorkOrderDto extends Partial<CreateWorkOrderDto> {}

export interface UpdateWorkOrderStatusDto {
  status: WorkOrderStatus;
  actualCost?: number;
  notes?: string;
}

export interface QueryWorkOrdersDto {
  vehicleId?: UUID;
  vendorId?: UUID;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateVendorDto {
  name: string;
  type?: VendorType;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  notes?: string;
}

export interface UpdateVendorDto extends Partial<CreateVendorDto> {
  isActive?: boolean;
}

export interface QueryVendorsDto {
  type?: VendorType;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateVendorInvoiceDto {
  vendorId: UUID;
  vehicleId?: UUID;
  workOrderId?: UUID;
  invoiceNumber: string;
  invoiceDate?: string;
  subtotal: number;
  tax?: number;
  total?: number;
  status?: VendorInvoiceStatus;
  notes?: string;
}

export interface UpdateVendorInvoiceDto extends Partial<CreateVendorInvoiceDto> {}

export interface QueryVendorInvoicesDto {
  vendorId?: UUID;
  status?: VendorInvoiceStatus;
  page?: number;
  limit?: number;
}

export interface CreateVehicleExpenseDto {
  vehicleId: UUID;
  driverId?: UUID;
  tripId?: UUID;
  vendorId?: UUID;
  fuelTransactionId?: UUID;
  maintenanceRecordId?: UUID;
  category: VehicleExpenseCategory;
  amount: number;
  date?: string;
  reference?: string;
  description?: string;
  source?: string;
}

export interface UpdateVehicleExpenseDto extends Partial<CreateVehicleExpenseDto> {}

export interface QueryVehicleExpensesDto {
  vehicleId?: UUID;
  driverId?: UUID;
  category?: VehicleExpenseCategory;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface QueryFleetCostsDto {
  vehicleId?: UUID;
  range?: 'today' | '7d' | '30d' | 'this_month' | 'custom';
  startDate?: string;
  endDate?: string;
}

