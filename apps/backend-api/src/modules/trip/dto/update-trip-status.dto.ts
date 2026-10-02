import {
  IsEnum,
  IsOptional,
  IsString,
  IsISO8601,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TripStatus } from '@ai-mos/types';

export class UpdateTripStatusDto {
  @ApiProperty({
    enum: [
      'SCHEDULED',
      'DRIVER_ASSIGNED',
      'VEHICLE_ASSIGNED',
      'DISPATCHED',
      'DRIVER_ARRIVED',
      'PASSENGER_ONBOARD',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
    ],
    description: 'Target trip status',
  })
  @IsEnum([
    'SCHEDULED',
    'DRIVER_ASSIGNED',
    'VEHICLE_ASSIGNED',
    'DISPATCHED',
    'DRIVER_ARRIVED',
    'PASSENGER_ONBOARD',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
  ])
  status!: TripStatus;

  @ApiPropertyOptional({ example: 'Passenger boarded on time' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ example: '2026-10-15T09:15:00.000Z' })
  @IsOptional()
  @IsISO8601()
  actualStartTime?: string;

  @ApiPropertyOptional({ example: '2026-10-15T10:05:00.000Z' })
  @IsOptional()
  @IsISO8601()
  actualEndTime?: string;

  @ApiPropertyOptional({ example: 12500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  startOdometer?: number;

  @ApiPropertyOptional({ example: 12530 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  endOdometer?: number;

  @ApiPropertyOptional({ example: 30.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional({ example: 70.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fareAmount?: number;
}
