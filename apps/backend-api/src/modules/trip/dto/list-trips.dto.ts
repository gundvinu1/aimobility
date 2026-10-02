import { IsOptional, IsEnum, IsString, IsInt, Min, IsISO8601, IsUUID } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { TripType, TripStatus } from '@ai-mos/types';

export class ListTripsDto {
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

  @ApiPropertyOptional({ description: 'Search by trip number, origin, destination, driver code, or vehicle number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
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
  })
  @IsOptional()
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
  status?: TripStatus;

  @ApiPropertyOptional({ enum: ['ONE_WAY', 'ROUND_TRIP', 'RENTAL', 'OUTSTATION', 'AIRPORT_TRANSFER'] })
  @IsOptional()
  @IsEnum(['ONE_WAY', 'ROUND_TRIP', 'RENTAL', 'OUTSTATION', 'AIRPORT_TRANSFER'])
  tripType?: TripType;

  @ApiPropertyOptional({ description: 'Filter by driver ID' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Filter by vehicle ID' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Filter by booking ID' })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ description: 'From date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'To date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  toDate?: string;

  @ApiPropertyOptional({
    enum: [
      'tripNumber',
      'tripType',
      'status',
      'scheduledStartTime',
      'scheduledEndTime',
      'actualStartTime',
      'actualEndTime',
      'createdAt',
    ],
    default: 'scheduledStartTime',
  })
  @IsOptional()
  @IsEnum([
    'tripNumber',
    'tripType',
    'status',
    'scheduledStartTime',
    'scheduledEndTime',
    'actualStartTime',
    'actualEndTime',
    'createdAt',
  ])
  sortBy?: string = 'scheduledStartTime';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
