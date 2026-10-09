import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FuelType } from '@prisma/client';
import type { FuelTransactionSource } from '@ai-mos/types';

export class CreateFuelTransactionDto {
  @ApiProperty({ description: 'ID of the vehicle refueled' })
  @IsUUID()
  vehicleId!: string;

  @ApiPropertyOptional({ description: 'Optional driver ID associated with refueling' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Optional trip ID during which refueling took place' })
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional({ description: 'Optional vendor/fuel station ID' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ enum: FuelType, default: FuelType.DIESEL })
  @IsOptional()
  @IsEnum(FuelType)
  fuelType?: FuelType;

  @ApiProperty({ description: 'Quantity in liters filled', example: 45.5 })
  @IsNumber()
  @IsPositive()
  quantityLiters!: number;

  @ApiProperty({ description: 'Price per liter', example: 1.55 })
  @IsNumber()
  @IsPositive()
  pricePerLiter!: number;

  @ApiPropertyOptional({ description: 'Total cost (computed if omitted)', example: 70.53 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  totalAmount?: number;

  @ApiPropertyOptional({ description: 'Odometer reading at fueling (km)', example: 45200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  odometer?: number;

  @ApiPropertyOptional({ description: 'Fuel level percentage or liters before refueling' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fuelLevelBefore?: number;

  @ApiPropertyOptional({ description: 'Fuel level percentage or liters after refueling' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fuelLevelAfter?: number;

  @ApiPropertyOptional({ enum: ['MANUAL', 'TELEMATICS', 'FUEL_CARD', 'IMPORT'], default: 'MANUAL' })
  @IsOptional()
  @IsEnum(['MANUAL', 'TELEMATICS', 'FUEL_CARD', 'IMPORT'] as const)
  transactionSource?: FuelTransactionSource;

  @ApiPropertyOptional({ description: 'Receipt number or external reference' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Name/brand of the fuel station' })
  @IsOptional()
  @IsString()
  stationName?: string;

  @ApiPropertyOptional({ description: 'Date and time of transaction (ISO)', example: '2026-10-08T10:30:00Z' })
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFuelTransactionDto extends PartialType(CreateFuelTransactionDto) {}

export class QueryFuelTransactionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ enum: FuelType })
  @IsOptional()
  @IsEnum(FuelType)
  fuelType?: FuelType;

  @ApiPropertyOptional({ enum: ['MANUAL', 'TELEMATICS', 'FUEL_CARD', 'IMPORT'] })
  @IsOptional()
  @IsEnum(['MANUAL', 'TELEMATICS', 'FUEL_CARD', 'IMPORT'] as const)
  transactionSource?: FuelTransactionSource;

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

export class QueryFuelAnalyticsDto {
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

  @ApiPropertyOptional({ enum: ['today', '7d', '30d', 'this_month', 'custom'] })
  @IsOptional()
  @IsString()
  range?: string;
}
