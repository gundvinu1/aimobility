import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import type { VehicleExpenseCategory } from '@ai-mos/types';

export class CreateVehicleExpenseDto {
  @ApiProperty({ description: 'Target vehicle ID' })
  @IsUUID()
  vehicleId!: string;

  @ApiPropertyOptional({ description: 'Optional driver ID associated' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Optional trip ID associated' })
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional({ description: 'Optional vendor ID associated' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Linked fuel transaction ID if applicable' })
  @IsOptional()
  @IsUUID()
  fuelTransactionId?: string;

  @ApiPropertyOptional({ description: 'Linked maintenance record ID if applicable' })
  @IsOptional()
  @IsUUID()
  maintenanceRecordId?: string;

  @ApiProperty({
    enum: [
      'FUEL',
      'MAINTENANCE',
      'REPAIR',
      'PARTS',
      'INSURANCE',
      'TAX',
      'TOLL',
      'PARKING',
      'CLEANING',
      'OTHER',
    ],
  })
  @IsEnum([
    'FUEL',
    'MAINTENANCE',
    'REPAIR',
    'PARTS',
    'INSURANCE',
    'TAX',
    'TOLL',
    'PARKING',
    'CLEANING',
    'OTHER',
  ] as const)
  category!: VehicleExpenseCategory;

  @ApiProperty({ description: 'Expense amount', example: 125.0 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ description: 'Expense occurrence date (ISO)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Receipt, invoice, or voucher reference' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Description or reason for expense' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Source channel (MANUAL, IMPORT, etc.)', default: 'MANUAL' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class UpdateVehicleExpenseDto extends PartialType(CreateVehicleExpenseDto) {}

export class QueryVehicleExpensesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({
    enum: [
      'FUEL',
      'MAINTENANCE',
      'REPAIR',
      'PARTS',
      'INSURANCE',
      'TAX',
      'TOLL',
      'PARKING',
      'CLEANING',
      'OTHER',
    ],
  })
  @IsOptional()
  @IsEnum([
    'FUEL',
    'MAINTENANCE',
    'REPAIR',
    'PARTS',
    'INSURANCE',
    'TAX',
    'TOLL',
    'PARKING',
    'CLEANING',
    'OTHER',
  ] as const)
  category?: VehicleExpenseCategory;

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
