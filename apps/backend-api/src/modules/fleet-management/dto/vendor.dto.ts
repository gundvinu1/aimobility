import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsEmail,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import type { VendorType, VendorInvoiceStatus } from '@ai-mos/types';

export class CreateVendorDto {
  @ApiProperty({ description: 'Vendor or business name', example: 'Apex Fleet Services Ltd' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    enum: ['SERVICE_CENTER', 'MECHANIC', 'FUEL_STATION', 'PARTS_SUPPLIER', 'OTHER'],
    default: 'SERVICE_CENTER',
  })
  @IsOptional()
  @IsEnum(['SERVICE_CENTER', 'MECHANIC', 'FUEL_STATION', 'PARTS_SUPPLIER', 'OTHER'] as const)
  type?: VendorType;

  @ApiPropertyOptional({ description: 'Contact person name' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Physical address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Tax registration number or VAT/GST ID' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateVendorDto extends PartialType(CreateVendorDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryVendorsDto {
  @ApiPropertyOptional({
    enum: ['SERVICE_CENTER', 'MECHANIC', 'FUEL_STATION', 'PARTS_SUPPLIER', 'OTHER'],
  })
  @IsOptional()
  @IsEnum(['SERVICE_CENTER', 'MECHANIC', 'FUEL_STATION', 'PARTS_SUPPLIER', 'OTHER'] as const)
  type?: VendorType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class CreateVendorInvoiceDto {
  @ApiProperty({ description: 'Issuing vendor ID' })
  @IsUUID()
  vendorId!: string;

  @ApiPropertyOptional({ description: 'Optional vehicle serviced' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Optional work order referenced' })
  @IsOptional()
  @IsUUID()
  workOrderId?: string;

  @ApiProperty({ description: 'Vendor invoice or bill number', example: 'INV-2026-9081' })
  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @ApiPropertyOptional({ description: 'Invoice issue date (ISO)' })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiProperty({ description: 'Subtotal before tax', example: 450.0 })
  @IsNumber()
  @Min(0)
  subtotal!: number;

  @ApiPropertyOptional({ description: 'Tax amount', example: 45.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({ description: 'Total invoice amount (calculated if omitted)', example: 495.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'RECEIVED', 'PAID', 'CANCELLED'], default: 'RECEIVED' })
  @IsOptional()
  @IsEnum(['DRAFT', 'RECEIVED', 'PAID', 'CANCELLED'] as const)
  status?: VendorInvoiceStatus;

  @ApiPropertyOptional({ description: 'Payment or accounting notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateVendorInvoiceDto extends PartialType(CreateVendorInvoiceDto) {}

export class QueryVendorInvoicesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'RECEIVED', 'PAID', 'CANCELLED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'RECEIVED', 'PAID', 'CANCELLED'] as const)
  status?: VendorInvoiceStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
