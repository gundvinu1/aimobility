import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateVendorDto,
  UpdateVendorDto,
  QueryVendorsDto,
  CreateVendorInvoiceDto,
  UpdateVendorInvoiceDto,
  QueryVendorInvoicesDto,
} from '../dto/vendor.dto';
import { FLEET_MANAGEMENT_AUDIT_EVENTS } from '@ai-mos/constants';
import type { VendorDto, VendorInvoiceDto } from '@ai-mos/types';

export interface AuditMeta {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);

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
          entityType: 'VENDOR',
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

  // ─── Vendors ────────────────────────────────────────────────────────────────

  async createVendor(
    companyId: string,
    dto: CreateVendorDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<VendorDto> {
    const created = await this.db.vendor.create({
      data: {
        companyId,
        name: dto.name,
        type: dto.type ?? 'SERVICE_CENTER',
        contactPerson: dto.contactPerson ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
        taxId: dto.taxId ?? null,
        isActive: true,
        notes: dto.notes ?? null,
        createdBy: userId ?? null,
      },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.VENDOR_CREATED,
      created.id,
      companyId,
      userId,
      meta,
      { name: dto.name },
    );

    return this.mapVendorToDto(created);
  }

  async listVendors(
    companyId: string,
    query: QueryVendorsDto,
  ): Promise<{ data: VendorDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: any = { companyId };
    if (query.type) where.type = query.type;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { contactPerson: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.vendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.db.vendor.count({ where }),
    ]);

    return {
      data: items.map((v) => this.mapVendorToDto(v)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getVendor(companyId: string, id: string): Promise<VendorDto> {
    const item = await this.db.vendor.findFirst({
      where: { id, companyId },
    });

    if (!item) {
      throw new NotFoundException(`Vendor ${id} not found`);
    }

    return this.mapVendorToDto(item);
  }

  async updateVendor(
    companyId: string,
    id: string,
    dto: UpdateVendorDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<VendorDto> {
    const existing = await this.db.vendor.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Vendor ${id} not found`);
    }

    const updated = await this.db.vendor.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.VENDOR_UPDATED,
      id,
      companyId,
      userId,
      meta,
    );

    return this.mapVendorToDto(updated);
  }

  async deleteVendor(
    companyId: string,
    id: string,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<{ success: boolean }> {
    const existing = await this.db.vendor.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Vendor ${id} not found`);
    }

    await this.db.vendor.delete({ where: { id } });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.VENDOR_DELETED,
      id,
      companyId,
      userId,
      meta,
    );

    return { success: true };
  }

  // ─── Vendor Invoices ────────────────────────────────────────────────────────

  async createInvoice(
    companyId: string,
    dto: CreateVendorInvoiceDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<VendorInvoiceDto> {
    const vendor = await this.db.vendor.findFirst({
      where: { id: dto.vendorId, companyId },
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor ${dto.vendorId} not found`);
    }

    if (dto.vehicleId) {
      const vehicle = await this.db.vehicle.findFirst({
        where: { id: dto.vehicleId, companyId, deletedAt: null },
      });
      if (!vehicle) {
        throw new BadRequestException(`Vehicle ${dto.vehicleId} not found in this company`);
      }
    }

    if (dto.workOrderId) {
      const wo = await this.db.workOrder.findFirst({
        where: { id: dto.workOrderId, companyId },
      });
      if (!wo) {
        throw new BadRequestException(`Work order ${dto.workOrderId} not found`);
      }
    }

    const subtotal = dto.subtotal;
    const tax = dto.tax ?? 0;
    const total = dto.total ?? Math.round((subtotal + tax) * 100) / 100;
    const invDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();

    const created = await this.db.vendorInvoice.create({
      data: {
        companyId,
        vendorId: dto.vendorId,
        vehicleId: dto.vehicleId ?? null,
        workOrderId: dto.workOrderId ?? null,
        invoiceNumber: dto.invoiceNumber,
        invoiceDate: invDate,
        subtotal,
        tax,
        total,
        status: dto.status ?? 'RECEIVED',
        notes: dto.notes ?? null,
        createdBy: userId ?? null,
      },
      include: {
        vendor: { select: { name: true } },
        vehicle: { select: { vehicleNumber: true } },
      },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.VENDOR_INVOICE_CREATED,
      created.id,
      companyId,
      userId,
      meta,
      { invoiceNumber: dto.invoiceNumber, total },
    );

    return this.mapInvoiceToDto(created);
  }

  async listInvoices(
    companyId: string,
    query: QueryVendorInvoicesDto,
  ): Promise<{ data: VendorInvoiceDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: any = { companyId };
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.status) where.status = query.status;

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.vendorInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          vendor: { select: { name: true } },
          vehicle: { select: { vehicleNumber: true } },
        },
      }),
      this.db.vendorInvoice.count({ where }),
    ]);

    return {
      data: items.map((i) => this.mapInvoiceToDto(i)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getInvoice(companyId: string, id: string): Promise<VendorInvoiceDto> {
    const item = await this.db.vendorInvoice.findFirst({
      where: { id, companyId },
      include: {
        vendor: { select: { name: true } },
        vehicle: { select: { vehicleNumber: true } },
      },
    });

    if (!item) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    return this.mapInvoiceToDto(item);
  }

  async updateInvoice(
    companyId: string,
    id: string,
    dto: UpdateVendorInvoiceDto,
    userId?: string,
    meta?: AuditMeta,
  ): Promise<VendorInvoiceDto> {
    const existing = await this.db.vendorInvoice.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    const subtotal = dto.subtotal ?? existing.subtotal;
    const tax = dto.tax ?? existing.tax;
    const total = dto.total ?? Math.round((subtotal + tax) * 100) / 100;

    const updated = await this.db.vendorInvoice.update({
      where: { id },
      data: {
        ...(dto.invoiceNumber ? { invoiceNumber: dto.invoiceNumber } : {}),
        ...(dto.invoiceDate ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
        subtotal,
        tax,
        total,
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: {
        vendor: { select: { name: true } },
        vehicle: { select: { vehicleNumber: true } },
      },
    });

    await this.logAudit(
      FLEET_MANAGEMENT_AUDIT_EVENTS.VENDOR_INVOICE_UPDATED,
      id,
      companyId,
      userId,
      meta,
    );

    return this.mapInvoiceToDto(updated);
  }

  private mapVendorToDto(v: any): VendorDto {
    return {
      id: v.id,
      companyId: v.companyId,
      name: v.name,
      type: v.type,
      contactPerson: v.contactPerson,
      phone: v.phone,
      email: v.email,
      address: v.address,
      taxId: v.taxId,
      isActive: v.isActive,
      notes: v.notes,
      createdBy: v.createdBy,
      createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  private mapInvoiceToDto(i: any): VendorInvoiceDto {
    return {
      id: i.id,
      companyId: i.companyId,
      vendorId: i.vendorId,
      vendorName: i.vendor?.name,
      vehicleId: i.vehicleId,
      vehicleNumber: i.vehicle?.vehicleNumber,
      workOrderId: i.workOrderId,
      invoiceNumber: i.invoiceNumber,
      invoiceDate: i.invoiceDate ? new Date(i.invoiceDate).toISOString() : new Date().toISOString(),
      subtotal: i.subtotal,
      tax: i.tax,
      total: i.total,
      status: i.status,
      notes: i.notes,
      createdBy: i.createdBy,
      createdAt: i.createdAt ? new Date(i.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: i.updatedAt ? new Date(i.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}
