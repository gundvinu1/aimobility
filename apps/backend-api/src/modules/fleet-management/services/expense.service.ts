import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateVehicleExpenseDto,
  UpdateVehicleExpenseDto,
  QueryVehicleExpensesDto,
} from '../dto/expense.dto';
import { QueryFleetCostsDto } from '../dto/cost-analytics.dto';
import { calculateCostPerKm } from '../utils/fleet-math.util';
import { FLEET_MANAGEMENT_AUDIT_EVENTS } from '@ai-mos/constants';
import type {
  VehicleExpenseDto,
  FleetCostSummaryDto,
  VehicleCostSummaryDto,
  CategoryCostSummaryDto,
  CostTrendDto,
  VehicleExpenseCategory,
} from '@ai-mos/types';

export interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(private readonly db: DatabaseService) {}

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
          entityType: 'VEHICLE_EXPENSE',
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

  // ─── Vehicle Expenses CRUD ──────────────────────────────────────────────────

  async createExpense(
    companyId: string,
    dto: CreateVehicleExpenseDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<VehicleExpenseDto> {
    const vehicle = await this.db.vehicle.findFirst({
      where: { id: dto.vehicleId, companyId, deletedAt: null },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${dto.vehicleId} not found in this company`);
    }

    if (dto.driverId) {
      const driver = await this.db.driver.findFirst({
        where: { id: dto.driverId, companyId, deletedAt: null },
      });
      if (!driver) {
        throw new BadRequestException(`Driver ${dto.driverId} not found in this company`);
      }
    }

    if (dto.tripId) {
      const trip = await this.db.trip.findFirst({
        where: { id: dto.tripId, companyId, deletedAt: null },
      });
      if (!trip) {
        throw new BadRequestException(`Trip ${dto.tripId} not found in this company`);
      }
    }

    if (dto.vendorId) {
      const vendor = await this.db.vendor.findFirst({
        where: { id: dto.vendorId, companyId },
      });
      if (!vendor) {
        throw new BadRequestException(`Vendor ${dto.vendorId} not found in this company`);
      }
    }

    if (dto.fuelTransactionId) {
      const fuelTx = await this.db.fuelTransaction.findFirst({
        where: { id: dto.fuelTransactionId, companyId },
      });
      if (!fuelTx) {
        throw new BadRequestException(`Fuel transaction ${dto.fuelTransactionId} not found in this company`);
      }
    }

    if (dto.maintenanceRecordId) {
      const maintRec = await this.db.maintenanceRecord.findFirst({
        where: { id: dto.maintenanceRecordId, companyId },
      });
      if (!maintRec) {
        throw new BadRequestException(`Maintenance record ${dto.maintenanceRecordId} not found in this company`);
      }
    }

    const expDate = dto.date ? new Date(dto.date) : new Date();

    const created = await this.db.vehicleExpense.create({
      data: {
        companyId,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId ?? null,
        tripId: dto.tripId ?? null,
        vendorId: dto.vendorId ?? null,
        fuelTransactionId: dto.fuelTransactionId ?? null,
        maintenanceRecordId: dto.maintenanceRecordId ?? null,
        category: dto.category,
        amount: dto.amount,
        date: expDate,
        reference: dto.reference ?? null,
        description: dto.description ?? null,
        source: dto.source ?? 'MANUAL',
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

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.VEHICLE_EXPENSE_CREATED,
      created.id,
      companyId,
      userId,
      meta,
      { category: dto.category, amount: dto.amount },
    );

    return this.mapToDto(created);
  }

  async listExpenses(
    companyId: string,
    query: QueryVehicleExpensesDto,
  ): Promise<{ data: VehicleExpenseDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: any = { companyId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.category) where.category = query.category;

    const { from, to } = this.resolveDateFilter(undefined, query.startDate, query.endDate);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.vehicleExpense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
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
      this.db.vehicleExpense.count({ where }),
    ]);

    return {
      data: items.map((e) => this.mapToDto(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getExpense(companyId: string, id: string): Promise<VehicleExpenseDto> {
    const item = await this.db.vehicleExpense.findFirst({
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
      throw new NotFoundException(`Expense ${id} not found`);
    }

    return this.mapToDto(item);
  }

  async updateExpense(
    companyId: string,
    id: string,
    dto: UpdateVehicleExpenseDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<VehicleExpenseDto> {
    const existing = await this.db.vehicleExpense.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Expense ${id} not found`);
    }

    const updated = await this.db.vehicleExpense.update({
      where: { id },
      data: {
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
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

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.VEHICLE_EXPENSE_UPDATED,
      id,
      companyId,
      userId,
      meta,
    );

    return this.mapToDto(updated);
  }

  async deleteExpense(
    companyId: string,
    id: string,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<{ success: boolean }> {
    const existing = await this.db.vehicleExpense.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Expense ${id} not found`);
    }

    await this.db.vehicleExpense.delete({ where: { id } });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.VEHICLE_EXPENSE_DELETED,
      id,
      companyId,
      userId,
      meta,
    );

    return { success: true };
  }

  // ─── TCO & Operating Cost Analytics ─────────────────────────────────────────

  async getCostSummary(companyId: string, query: QueryFleetCostsDto): Promise<FleetCostSummaryDto> {
    const where: any = { companyId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;

    const { from, to } = this.resolveDateFilter(query.range, query.startDate, query.endDate);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const expenses = await this.db.vehicleExpense.findMany({
      where,
      select: { category: true, amount: true, vehicleId: true },
    });

    let fuelCost = 0;
    let maintenanceCost = 0;
    let repairCost = 0;
    let otherCost = 0;

    const uniqueVehicles = new Set<string>();

    for (const exp of expenses) {
      uniqueVehicles.add(exp.vehicleId);
      if (exp.category === 'FUEL') {
        fuelCost += exp.amount;
      } else if (exp.category === 'MAINTENANCE') {
        maintenanceCost += exp.amount;
      } else if (exp.category === 'REPAIR') {
        repairCost += exp.amount;
      } else {
        otherCost += exp.amount;
      }
    }

    const totalOperatingCost = Math.round((fuelCost + maintenanceCost + repairCost + otherCost) * 100) / 100;

    // Calculate total distance from trips or odometers
    const tripWhere: any = {
      companyId,
      status: 'COMPLETED',
    };
    if (query.vehicleId) tripWhere.vehicleId = query.vehicleId;
    if (from || to) {
      tripWhere.actualEnd = {};
      if (from) tripWhere.actualEnd.gte = from;
      if (to) tripWhere.actualEnd.lte = to;
    }

    const completedTrips = await this.db.trip.findMany({
      where: tripWhere,
      select: { distanceKm: true },
    });

    let totalDistanceKm = 0;
    for (const trip of completedTrips) {
      if (trip.distanceKm && trip.distanceKm > 0) {
        totalDistanceKm += trip.distanceKm;
      }
    }

    // Fallback to vehicle odometers if no completed trip distance is recorded
    if (totalDistanceKm === 0) {
      const vehicles = await this.db.vehicle.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(query.vehicleId ? { id: query.vehicleId } : {}),
        },
        select: { odometer: true },
      });
      totalDistanceKm = vehicles.reduce((sum, v) => sum + (v.odometer || 0), 0);
    }

    totalDistanceKm = Math.round(totalDistanceKm * 100) / 100;
    const costPerKm = calculateCostPerKm(totalOperatingCost, totalDistanceKm);

    return {
      totalOperatingCost,
      fuelCost: Math.round(fuelCost * 100) / 100,
      maintenanceCost: Math.round(maintenanceCost * 100) / 100,
      repairCost: Math.round(repairCost * 100) / 100,
      otherCost: Math.round(otherCost * 100) / 100,
      totalDistanceKm,
      costPerKm,
      vehicleCount: uniqueVehicles.size,
    };
  }

  async getVehicleCosts(companyId: string, query: QueryFleetCostsDto): Promise<VehicleCostSummaryDto[]> {
    const where: any = { companyId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;

    const { from, to } = this.resolveDateFilter(query.range, query.startDate, query.endDate);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const [vehicles, expenses, trips] = await Promise.all([
      this.db.vehicle.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(query.vehicleId ? { id: query.vehicleId } : {}),
        },
        select: { id: true, vehicleNumber: true, make: true, model: true, odometer: true },
      }),
      this.db.vehicleExpense.findMany({
        where,
        select: { vehicleId: true, category: true, amount: true },
      }),
      this.db.trip.findMany({
        where: {
          companyId,
          status: 'COMPLETED',
          ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
          ...(from || to ? { actualEnd: { gte: from, lte: to } } : {}),
        },
        select: { vehicleId: true, distanceKm: true },
      }),
    ]);

    const vehicleCostMap = new Map<
      string,
      { fuel: number; maintenance: number; repair: number; other: number; distance: number }
    >();

    for (const v of vehicles) {
      vehicleCostMap.set(v.id, {
        fuel: 0,
        maintenance: 0,
        repair: 0,
        other: 0,
        distance: v.odometer || 0,
      });
    }

    // Overwrite distance with completed trip distances if available
    const tripDistanceMap = new Map<string, number>();
    for (const t of trips) {
      if (t.vehicleId && t.distanceKm && t.distanceKm > 0) {
        tripDistanceMap.set(t.vehicleId, (tripDistanceMap.get(t.vehicleId) || 0) + t.distanceKm);
      }
    }
    for (const [vId, dist] of tripDistanceMap.entries()) {
      const entry = vehicleCostMap.get(vId);
      if (entry) entry.distance = dist;
    }

    for (const exp of expenses) {
      let entry = vehicleCostMap.get(exp.vehicleId);
      if (!entry) {
        entry = { fuel: 0, maintenance: 0, repair: 0, other: 0, distance: 0 };
        vehicleCostMap.set(exp.vehicleId, entry);
      }
      if (exp.category === 'FUEL') entry.fuel += exp.amount;
      else if (exp.category === 'MAINTENANCE') entry.maintenance += exp.amount;
      else if (exp.category === 'REPAIR') entry.repair += exp.amount;
      else entry.other += exp.amount;
    }

    const results: VehicleCostSummaryDto[] = vehicles.map((v) => {
      const c = vehicleCostMap.get(v.id) || { fuel: 0, maintenance: 0, repair: 0, other: 0, distance: 0 };
      const totalOperatingCost = Math.round((c.fuel + c.maintenance + c.repair + c.other) * 100) / 100;
      const costPerKm = calculateCostPerKm(totalOperatingCost, c.distance);

      return {
        vehicleId: v.id,
        vehicleNumber: v.vehicleNumber,
        make: v.make,
        model: v.model,
        totalOperatingCost,
        fuelCost: Math.round(c.fuel * 100) / 100,
        maintenanceCost: Math.round(c.maintenance * 100) / 100,
        repairCost: Math.round(c.repair * 100) / 100,
        otherCost: Math.round(c.other * 100) / 100,
        distanceKm: Math.round(c.distance * 100) / 100,
        costPerKm,
      };
    });

    return results.sort((a, b) => b.totalOperatingCost - a.totalOperatingCost);
  }

  async getCategoryCosts(companyId: string, query: QueryFleetCostsDto): Promise<CategoryCostSummaryDto[]> {
    const where: any = { companyId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;

    const { from, to } = this.resolveDateFilter(query.range, query.startDate, query.endDate);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const expenses = await this.db.vehicleExpense.findMany({
      where,
      select: { category: true, amount: true },
    });

    const categoryMap = new Map<VehicleExpenseCategory, { total: number; count: number }>();
    let overallTotal = 0;

    for (const exp of expenses) {
      overallTotal += exp.amount;
      const cur = categoryMap.get(exp.category as VehicleExpenseCategory) || { total: 0, count: 0 };
      cur.total += exp.amount;
      cur.count += 1;
      categoryMap.set(exp.category as VehicleExpenseCategory, cur);
    }

    const results: CategoryCostSummaryDto[] = [];
    for (const [cat, data] of categoryMap.entries()) {
      results.push({
        category: cat,
        totalAmount: Math.round(data.total * 100) / 100,
        percentage: overallTotal > 0 ? Math.round((data.total / overallTotal) * 10000) / 100 : 0,
        count: data.count,
      });
    }

    return results.sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async getCostTrends(companyId: string, query: QueryFleetCostsDto): Promise<CostTrendDto[]> {
    const where: any = { companyId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;

    const { from, to } = this.resolveDateFilter(query.range, query.startDate, query.endDate);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const expenses = await this.db.vehicleExpense.findMany({
      where,
      orderBy: { date: 'asc' },
      select: { date: true, category: true, amount: true },
    });

    const periodMap = new Map<string, { fuel: number; maintenance: number; repair: number; other: number }>();

    for (const exp of expenses) {
      const period = exp.date.toISOString().slice(0, 7); // YYYY-MM
      let cur = periodMap.get(period);
      if (!cur) {
        cur = { fuel: 0, maintenance: 0, repair: 0, other: 0 };
        periodMap.set(period, cur);
      }
      if (exp.category === 'FUEL') cur.fuel += exp.amount;
      else if (exp.category === 'MAINTENANCE') cur.maintenance += exp.amount;
      else if (exp.category === 'REPAIR') cur.repair += exp.amount;
      else cur.other += exp.amount;
    }

    const results: CostTrendDto[] = [];
    for (const [period, data] of periodMap.entries()) {
      const totalCost = Math.round((data.fuel + data.maintenance + data.repair + data.other) * 100) / 100;
      results.push({
        period,
        fuelCost: Math.round(data.fuel * 100) / 100,
        maintenanceCost: Math.round(data.maintenance * 100) / 100,
        repairCost: Math.round(data.repair * 100) / 100,
        otherCost: Math.round(data.other * 100) / 100,
        totalCost,
      });
    }

    return results;
  }

  private mapToDto(e: any): VehicleExpenseDto {
    const driverName = e.driver?.employee
      ? `${e.driver.employee.firstName} ${e.driver.employee.lastName}`.trim()
      : null;

    return {
      id: e.id,
      companyId: e.companyId,
      vehicleId: e.vehicleId,
      vehicleNumber: e.vehicle?.vehicleNumber,
      driverId: e.driverId,
      driverName,
      tripId: e.tripId,
      tripNumber: e.trip?.tripNumber,
      vendorId: e.vendorId,
      vendorName: e.vendor?.name,
      fuelTransactionId: e.fuelTransactionId,
      maintenanceRecordId: e.maintenanceRecordId,
      category: e.category,
      amount: e.amount,
      date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
      reference: e.reference,
      description: e.description,
      source: e.source,
      createdBy: e.createdBy,
      createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: e.updatedAt ? new Date(e.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}
