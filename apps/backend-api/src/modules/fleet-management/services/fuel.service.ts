import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateFuelTransactionDto,
  UpdateFuelTransactionDto,
  QueryFuelTransactionsDto,
  QueryFuelAnalyticsDto,
} from '../dto/fuel.dto';
import {
  calculateFuelTotal,
  calculateKmPerLiter,
  calculateLitersPer100Km,
  calculateCostPerKm,
} from '../utils/fleet-math.util';
import { FLEET_MANAGEMENT_AUDIT_EVENTS } from '@ai-mos/constants';
import type { FuelTransactionDto, FuelAnalyticsDto } from '@ai-mos/types';

export interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class FuelService {
  private readonly logger = new Logger(FuelService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Log an audit event
   */
  private async logAudit(
    action: string,
    entityId: string,
    companyId: string,
    userId?: string,
    meta?: AuditMeta,
    metadata?: Record<string, unknown>,
  ) {
    try {
      await this.db.auditLog.create({
        data: {
          action,
          entityType: 'FUEL_TRANSACTION',
          entityId,
          userId: userId ?? null,
          metadata: { companyId, ...metadata },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          requestId: meta?.requestId,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to log audit for ${action}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Parse date boundaries for analytics and filtering
   */
  private resolveDateFilter(range?: string, startDate?: string, endDate?: string): { from?: Date; to?: Date } {
    if (startDate || endDate) {
      return {
        from: startDate ? new Date(startDate) : undefined,
        to: endDate ? new Date(endDate) : undefined,
      };
    }

    const now = new Date();
    if (range === 'today') {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from, to: now };
    }
    if (range === '7d') {
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from, to: now };
    }
    if (range === '30d') {
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from, to: now };
    }
    if (range === 'this_month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: now };
    }

    return {};
  }

  /**
   * Create a new fuel transaction and automatically link a unified vehicle expense.
   */
  async createFuelTransaction(
    companyId: string,
    dto: CreateFuelTransactionDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<FuelTransactionDto> {
    // 1. Verify vehicle belongs to tenant
    const vehicle = await this.db.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId, deletedAt: null },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${dto.vehicleId} not found in this company`);
    }

    if (dto.quantityLiters <= 0) {
      throw new BadRequestException('Fuel quantity must be greater than zero');
    }
    if (dto.pricePerLiter <= 0) {
      throw new BadRequestException('Price per liter must be greater than zero');
    }

    // 2. Validate driver ownership if specified
    if (dto.driverId) {
      const driver = await this.db.driver.findFirst({
        where: { id: dto.driverId, companyId, deletedAt: null },
      });
      if (!driver) {
        throw new BadRequestException(`Driver ${dto.driverId} does not belong to this company`);
      }
    }

    // 3. Validate trip ownership if specified
    if (dto.tripId) {
      const trip = await this.db.trip.findFirst({
        where: { id: dto.tripId, companyId, deletedAt: null },
      });
      if (!trip) {
        throw new BadRequestException(`Trip ${dto.tripId} does not belong to this company`);
      }
    }

    // 4. Validate vendor ownership if specified
    if (dto.vendorId) {
      const vendor = await this.db.vendor.findFirst({
        where: { id: dto.vendorId, companyId },
      });
      if (!vendor) {
        throw new BadRequestException(`Vendor ${dto.vendorId} does not belong to this company`);
      }
    }

    // 5. Calculate or validate total amount
    const computedTotal = calculateFuelTotal(dto.quantityLiters, dto.pricePerLiter);
    const finalTotal = dto.totalAmount ?? computedTotal;

    const txDate = dto.transactionDate ? new Date(dto.transactionDate) : new Date();

    // 6. Persist FuelTransaction
    const created = await this.db.fuelTransaction.create({
      data: {
        companyId,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId ?? null,
        tripId: dto.tripId ?? null,
        vendorId: dto.vendorId ?? null,
        fuelType: dto.fuelType ?? vehicle.fuelType,
        quantityLiters: dto.quantityLiters,
        pricePerLiter: dto.pricePerLiter,
        totalAmount: finalTotal,
        odometer: dto.odometer ?? null,
        fuelLevelBefore: dto.fuelLevelBefore ?? null,
        fuelLevelAfter: dto.fuelLevelAfter ?? null,
        transactionSource: dto.transactionSource ?? 'MANUAL',
        reference: dto.reference ?? null,
        stationName: dto.stationName ?? null,
        transactionDate: txDate,
        notes: dto.notes ?? null,
        createdBy: userId ?? null,
      },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: {
          select: {
            driverCode: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        trip: { select: { tripNumber: true } },
        vendor: { select: { name: true } },
      },
    });

    // 7. Update vehicle odometer if transaction odometer is higher
    if (dto.odometer !== undefined && dto.odometer > vehicle.odometer) {
      await this.db.vehicle.update({
        where: { id: dto.vehicleId },
        data: { odometer: dto.odometer },
      });
    }

    // 8. Automatically link a VehicleExpense row
    await this.db.vehicleExpense.create({
      data: {
        companyId,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId ?? null,
        tripId: dto.tripId ?? null,
        vendorId: dto.vendorId ?? null,
        fuelTransactionId: created.id,
        category: 'FUEL',
        amount: finalTotal,
        date: txDate,
        reference: dto.reference ?? `Fuel Ref: ${created.id.slice(0, 8)}`,
        description: `Fuel purchase: ${dto.quantityLiters}L @ ${dto.pricePerLiter}/L`,
        source: 'FUEL_TRANSACTION',
        createdBy: userId ?? null,
      },
    });

    // 9. Audit log
    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.FUEL_TRANSACTION_CREATED,
      created.id,
      companyId,
      userId,
      meta,
      { vehicleId: dto.vehicleId, totalAmount: finalTotal },
    );

    return this.mapToDto(created);
  }

  /**
   * List fuel transactions with filtering and pagination
   */
  async listFuelTransactions(
    companyId: string,
    query: QueryFuelTransactionsDto,
  ): Promise<{ data: FuelTransactionDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: any = { companyId };

    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.driverId) where.driverId = query.driverId;
    if (query.fuelType) where.fuelType = query.fuelType;
    if (query.transactionSource) where.transactionSource = query.transactionSource;

    const { from, to } = this.resolveDateFilter(undefined, query.startDate, query.endDate);
    if (from || to) {
      where.transactionDate = {};
      if (from) where.transactionDate.gte = from;
      if (to) where.transactionDate.lte = to;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.fuelTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          vehicle: { select: { vehicleNumber: true } },
          driver: {
            select: {
              driverCode: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
          trip: { select: { tripNumber: true } },
          vendor: { select: { name: true } },
        },
      }),
      this.db.fuelTransaction.count({ where }),
    ]);

    return {
      data: items.map((i) => this.mapToDto(i)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get single transaction by ID with tenant isolation
   */
  async getFuelTransaction(companyId: string, id: string): Promise<FuelTransactionDto> {
    const item = await this.db.fuelTransaction.findFirst({
      where: { id, companyId },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: {
          select: {
            driverCode: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        trip: { select: { tripNumber: true } },
        vendor: { select: { name: true } },
      },
    });

    if (!item) {
      throw new NotFoundException(`Fuel transaction ${id} not found`);
    }

    return this.mapToDto(item);
  }

  /**
   * Update a fuel transaction
   */
  async updateFuelTransaction(
    companyId: string,
    id: string,
    dto: UpdateFuelTransactionDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<FuelTransactionDto> {
    const existing = await this.db.fuelTransaction.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Fuel transaction ${id} not found`);
    }

    const updatedQty = dto.quantityLiters ?? existing.quantityLiters;
    const updatedPrice = dto.pricePerLiter ?? existing.pricePerLiter;
    const updatedTotal = dto.totalAmount ?? calculateFuelTotal(updatedQty, updatedPrice);

    const updated = await this.db.fuelTransaction.update({
      where: { id },
      data: {
        ...(dto.fuelType ? { fuelType: dto.fuelType } : {}),
        ...(dto.quantityLiters !== undefined ? { quantityLiters: dto.quantityLiters } : {}),
        ...(dto.pricePerLiter !== undefined ? { pricePerLiter: dto.pricePerLiter } : {}),
        totalAmount: updatedTotal,
        ...(dto.odometer !== undefined ? { odometer: dto.odometer } : {}),
        ...(dto.fuelLevelBefore !== undefined ? { fuelLevelBefore: dto.fuelLevelBefore } : {}),
        ...(dto.fuelLevelAfter !== undefined ? { fuelLevelAfter: dto.fuelLevelAfter } : {}),
        ...(dto.transactionSource ? { transactionSource: dto.transactionSource } : {}),
        ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
        ...(dto.stationName !== undefined ? { stationName: dto.stationName } : {}),
        ...(dto.transactionDate ? { transactionDate: new Date(dto.transactionDate) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: {
          select: {
            driverCode: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        trip: { select: { tripNumber: true } },
        vendor: { select: { name: true } },
      },
    });

    // Sync corresponding vehicleExpense amount
    await this.db.vehicleExpense.updateMany({
      where: { fuelTransactionId: id, companyId },
      data: { amount: updatedTotal },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.FUEL_TRANSACTION_UPDATED,
      id,
      companyId,
      userId,
      meta,
      { totalAmount: updatedTotal },
    );

    return this.mapToDto(updated);
  }

  /**
   * Delete a fuel transaction
   */
  async deleteFuelTransaction(
    companyId: string,
    id: string,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<{ success: boolean }> {
    const existing = await this.db.fuelTransaction.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Fuel transaction ${id} not found`);
    }

    // Delete associated expense
    await this.db.vehicleExpense.deleteMany({
      where: { fuelTransactionId: id, companyId },
    });

    await this.db.fuelTransaction.delete({
      where: { id },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.FUEL_TRANSACTION_DELETED,
      id,
      companyId,
      userId,
      meta,
    );

    return { success: true };
  }

  /**
   * Aggregate fuel analytics metrics for fleet and individual vehicles
   */
  async getFuelAnalytics(companyId: string, query: QueryFuelAnalyticsDto): Promise<FuelAnalyticsDto> {
    const where: any = { companyId };
    if (query.vehicleId) {
      where.vehicleId = query.vehicleId;
    }

    const { from, to } = this.resolveDateFilter(query.range, query.startDate, query.endDate);
    if (from || to) {
      where.transactionDate = {};
      if (from) where.transactionDate.gte = from;
      if (to) where.transactionDate.lte = to;
    }

    const transactions = await this.db.fuelTransaction.findMany({
      where,
      orderBy: { transactionDate: 'asc' },
      select: {
        quantityLiters: true,
        totalAmount: true,
        pricePerLiter: true,
        odometer: true,
        vehicleId: true,
      },
    });

    const transactionCount = transactions.length;
    if (transactionCount === 0) {
      return {
        totalFuelConsumed: 0,
        totalFuelCost: 0,
        avgPricePerLiter: 0,
        avgKmPerLiter: 0,
        avgLitersPer100Km: 0,
        fuelCostPerKm: 0,
        totalDistanceKm: 0,
        transactionCount: 0,
      };
    }

    let totalFuelConsumed = 0;
    let totalFuelCost = 0;

    for (const tx of transactions) {
      totalFuelConsumed += tx.quantityLiters;
      totalFuelCost += tx.totalAmount;
    }

    // Calculate total distance covered between minimum and maximum odometers per vehicle
    const vehicleOdos = new Map<string, { min: number; max: number }>();
    for (const tx of transactions) {
      if (tx.odometer !== null && tx.odometer > 0) {
        const existing = vehicleOdos.get(tx.vehicleId);
        if (!existing) {
          vehicleOdos.set(tx.vehicleId, { min: tx.odometer, max: tx.odometer });
        } else {
          existing.min = Math.min(existing.min, tx.odometer);
          existing.max = Math.max(existing.max, tx.odometer);
        }
      }
    }

    let totalDistanceKm = 0;
    for (const { min, max } of vehicleOdos.values()) {
      if (max > min) {
        totalDistanceKm += max - min;
      }
    }

    const avgPricePerLiter =
      totalFuelConsumed > 0 ? Math.round((totalFuelCost / totalFuelConsumed) * 100) / 100 : 0;
    const avgKmPerLiter = calculateKmPerLiter(totalDistanceKm, totalFuelConsumed);
    const avgLitersPer100Km = calculateLitersPer100Km(totalDistanceKm, totalFuelConsumed);
    const fuelCostPerKm = calculateCostPerKm(totalFuelCost, totalDistanceKm);

    return {
      totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      avgPricePerLiter,
      avgKmPerLiter,
      avgLitersPer100Km,
      fuelCostPerKm,
      totalDistanceKm,
      transactionCount,
    };
  }

  private mapToDto(tx: any): FuelTransactionDto {
    const driverName = tx.driver?.employee
      ? `${tx.driver.employee.firstName} ${tx.driver.employee.lastName}`.trim()
      : null;

    return {
      id: tx.id,
      companyId: tx.companyId,
      vehicleId: tx.vehicleId,
      vehicleNumber: tx.vehicle?.vehicleNumber,
      driverId: tx.driverId,
      driverName,
      tripId: tx.tripId,
      tripNumber: tx.trip?.tripNumber,
      vendorId: tx.vendorId,
      vendorName: tx.vendor?.name,
      fuelType: tx.fuelType,
      quantityLiters: tx.quantityLiters,
      pricePerLiter: tx.pricePerLiter,
      totalAmount: tx.totalAmount,
      odometer: tx.odometer,
      fuelLevelBefore: tx.fuelLevelBefore,
      fuelLevelAfter: tx.fuelLevelAfter,
      transactionSource: tx.transactionSource,
      reference: tx.reference,
      stationName: tx.stationName,
      transactionDate: tx.transactionDate.toISOString(),
      notes: tx.notes,
      createdBy: tx.createdBy,
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    };
  }
}
