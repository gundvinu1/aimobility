import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import { VendorService } from '../services/vendor.service';
import {
  CreateVendorDto,
  UpdateVendorDto,
  QueryVendorsDto,
  CreateVendorInvoiceDto,
  UpdateVendorInvoiceDto,
  QueryVendorInvoicesDto,
} from '../dto/vendor.dto';
import { TenantGuard } from '../../company/guards/tenant.guard';
import { CurrentCompany } from '../../company/decorators/current-company.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { enforcePermission } from '../guards/fleet-permission.util';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { TenantContext } from '../../company/types/tenant.type';
import {
  COMPANY_HEADER,
  FLEET_MANAGEMENT_PERMISSIONS,
} from '@ai-mos/constants';
import type { VendorDto, VendorInvoiceDto } from '@ai-mos/types';

@ApiTags('Vendors & Invoices')
@ApiBearerAuth()
@ApiHeader({ name: COMPANY_HEADER, description: 'Active company context', required: true })
@UseGuards(TenantGuard)
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  // ─── Vendors ────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new vendor' })
  @ApiResponse({ status: 201, description: 'Vendor created' })
  async create(
    @Body() dto: CreateVendorDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<VendorDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.VENDOR_CREATE);
    return this.vendorService.createVendor(tenant.companyId, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List company vendors' })
  @ApiResponse({ status: 200, description: 'List of vendors' })
  async list(
    @Query() query: QueryVendorsDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.VENDOR_READ);
    return this.vendorService.listVendors(tenant.companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor by ID' })
  @ApiResponse({ status: 200, description: 'Vendor details' })
  async getById(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<VendorDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.VENDOR_READ);
    return this.vendorService.getVendor(tenant.companyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vendor' })
  @ApiResponse({ status: 200, description: 'Updated vendor' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<VendorDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.VENDOR_UPDATE);
    return this.vendorService.updateVendor(tenant.companyId, id, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vendor' })
  @ApiResponse({ status: 200, description: 'Deleted vendor' })
  async delete(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.VENDOR_DELETE);
    return this.vendorService.deleteVendor(tenant.companyId, id, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  // ─── Vendor Invoices ────────────────────────────────────────────────────────

  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create vendor invoice' })
  @ApiResponse({ status: 201, description: 'Vendor invoice created' })
  async createInvoice(
    @Body() dto: CreateVendorInvoiceDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<VendorInvoiceDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.INVOICE_CREATE);
    return this.vendorService.createInvoice(tenant.companyId, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List vendor invoices' })
  @ApiResponse({ status: 200, description: 'List of vendor invoices' })
  async listInvoices(
    @Query() query: QueryVendorInvoicesDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ) {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.INVOICE_READ);
    return this.vendorService.listInvoices(tenant.companyId, query);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get vendor invoice by ID' })
  @ApiResponse({ status: 200, description: 'Invoice details' })
  async getInvoice(
    @Param('id') id: string,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
  ): Promise<VendorInvoiceDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.INVOICE_READ);
    return this.vendorService.getInvoice(tenant.companyId, id);
  }

  @Patch('invoices/:id')
  @ApiOperation({ summary: 'Update vendor invoice' })
  @ApiResponse({ status: 200, description: 'Updated vendor invoice' })
  async updateInvoice(
    @Param('id') id: string,
    @Body() dto: UpdateVendorInvoiceDto,
    @CurrentCompany() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<VendorInvoiceDto> {
    enforcePermission(user, tenant.role, FLEET_MANAGEMENT_PERMISSIONS.INVOICE_UPDATE);
    return this.vendorService.updateInvoice(tenant.companyId, id, dto, user.userId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }
}
