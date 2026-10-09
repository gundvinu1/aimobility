import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import type { MaintenanceDueStatus } from '@ai-mos/types';

export class CreateMaintenanceScheduleDto {
  @ApiProperty({ description: 'Target vehicle ID' })
  @IsUUID()
  vehicleId!: string;

  @ApiProperty({ description: 'Service type, e.g. Engine Oil & Filter', example: 'Engine Oil & Filter' })
  @IsString()
  @IsNotEmpty()
  serviceType!: string;

  @ApiPropertyOptional({ description: 'Description or service checklist items' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Interval in kilometers (e.g. 10000)', example: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalKm?: number;

  @ApiPropertyOptional({ description: 'Interval in days (e.g. 180 for 6 months)', example: 180 })
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @ApiPropertyOptional({ description: 'Odometer reading at last service (km)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lastServiceOdometer?: number;

  @ApiPropertyOptional({ description: 'Date of last service (ISO)' })
  @IsOptional()
  @IsDateString()
  lastServiceDate?: string;

  @ApiPropertyOptional({ description: 'Calculated or explicit next due odometer (km)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  nextDueOdometer?: number;

  @ApiPropertyOptional({ description: 'Calculated or explicit next due date (ISO)' })
  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMaintenanceScheduleDto extends PartialType(CreateMaintenanceScheduleDto) {}

export class QueryMaintenanceSchedulesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ enum: ['UPCOMING', 'DUE_SOON', 'DUE', 'OVERDUE', 'COMPLETED'] })
  @IsOptional()
  @IsEnum(['UPCOMING', 'DUE_SOON', 'DUE', 'OVERDUE', 'COMPLETED'] as const)
  dueStatus?: MaintenanceDueStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

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

export class CreateMaintenanceRecordDto {
  @ApiProperty({ description: 'Target vehicle ID' })
  @IsUUID()
  vehicleId!: string;

  @ApiPropertyOptional({ description: 'Optional maintenance schedule ID fulfilled' })
  @IsOptional()
  @IsUUID()
  scheduleId?: string;

  @ApiPropertyOptional({ description: 'Optional work order ID associated' })
  @IsOptional()
  @IsUUID()
  workOrderId?: string;

  @ApiPropertyOptional({ description: 'Optional vendor / workshop ID' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiProperty({ description: 'Service type fulfilled', example: 'Brake Pad Replacement' })
  @IsString()
  @IsNotEmpty()
  serviceType!: string;

  @ApiPropertyOptional({ description: 'Odometer reading at time of service (km)', example: 52000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  odometer?: number;

  @ApiPropertyOptional({ description: 'Date service was performed (ISO)' })
  @IsOptional()
  @IsDateString()
  serviceDate?: string;

  @ApiPropertyOptional({ description: 'Cost of replacement parts', example: 120.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  partsCost?: number;

  @ApiPropertyOptional({ description: 'Labor cost', example: 80.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCost?: number;

  @ApiPropertyOptional({ description: 'Tax amount', example: 20.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({ description: 'Total cost (computed if omitted)', example: 220.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCost?: number;

  @ApiPropertyOptional({ description: 'Service summary or technician remarks' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Invoice / receipt reference' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class QueryMaintenanceRecordsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

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
