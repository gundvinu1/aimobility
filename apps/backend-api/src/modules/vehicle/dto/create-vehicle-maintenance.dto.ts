import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsISO8601,
  IsInt,
  IsDecimal,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { MaintenanceType, MaintenanceStatus } from '@ai-mos/types';

export class CreateVehicleMaintenanceDto {
  @ApiPropertyOptional({ enum: ['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION', 'OTHER'], default: 'PREVENTIVE' })
  @IsOptional()
  @IsEnum(['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION', 'OTHER'])
  maintenanceType?: MaintenanceType;

  @ApiProperty({ example: 'Oil change and filter replacement' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ example: '2024-06-01' })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 45000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometerAtService?: number;

  @ApiPropertyOptional({ example: '2500.00' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  cost?: string;

  @ApiPropertyOptional({ example: 'City Garage Pvt Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  vendor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateMaintenanceStatusDto {
  @ApiProperty({ enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @IsEnum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  @IsNotEmpty()
  status!: MaintenanceStatus;

  @ApiPropertyOptional({ example: '2024-06-05' })
  @IsOptional()
  @IsISO8601()
  completedAt?: string;

  @ApiPropertyOptional({ example: '2500.00' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  cost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
