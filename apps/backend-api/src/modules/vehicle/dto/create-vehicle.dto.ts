import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsISO8601,
  IsUrl,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { FuelType, VehicleOwnership } from '@ai-mos/types';

export class CreateVehicleDto {
  // ─── Identity ─────────────────────────────────────────────────────────────

  @ApiProperty({ example: 'MH12AB1234' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  vehicleNumber!: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  make!: string;

  @ApiProperty({ example: 'Innova Crysta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model!: string;

  @ApiProperty({ example: 2022 })
  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;

  @ApiPropertyOptional({ example: 'White' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ example: 'MATP23BA4N7123456' })
  @IsOptional()
  @IsString()
  @MaxLength(17)
  vin?: string;

  // ─── Classification ───────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG', 'OTHER'], default: 'DIESEL' })
  @IsOptional()
  @IsEnum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG', 'OTHER'])
  fuelType?: FuelType;

  @ApiPropertyOptional({ enum: ['OWNED', 'LEASED', 'RENTED'], default: 'OWNED' })
  @IsOptional()
  @IsEnum(['OWNED', 'LEASED', 'RENTED'])
  ownership?: VehicleOwnership;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  odometer?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  // ─── Registration ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsISO8601()
  registrationExpiry?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsISO8601()
  insuranceExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
