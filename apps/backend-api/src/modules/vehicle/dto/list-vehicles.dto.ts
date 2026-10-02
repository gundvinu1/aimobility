import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { VehicleStatus, FuelType, VehicleOwnership } from '@ai-mos/types';

export class ListVehiclesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED', 'ON_TRIP'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED', 'ON_TRIP'])
  status?: VehicleStatus;

  @ApiPropertyOptional({ enum: ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG', 'OTHER'] })
  @IsOptional()
  @IsEnum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG', 'OTHER'])
  fuelType?: FuelType;

  @ApiPropertyOptional({ enum: ['OWNED', 'LEASED', 'RENTED'] })
  @IsOptional()
  @IsEnum(['OWNED', 'LEASED', 'RENTED'])
  ownership?: VehicleOwnership;

  @ApiPropertyOptional({ enum: ['vehicleNumber', 'make', 'model', 'year', 'status', 'createdAt'] })
  @IsOptional()
  @IsEnum(['vehicleNumber', 'make', 'model', 'year', 'status', 'createdAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
