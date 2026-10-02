import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TripType } from '@ai-mos/types';

export class CreateTripDto {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Linked booking ID if any' })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174001', description: 'Assigned vehicle ID' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174002', description: 'Assigned driver ID' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ enum: ['ONE_WAY', 'ROUND_TRIP', 'RENTAL', 'OUTSTATION', 'AIRPORT_TRANSFER'], default: 'ONE_WAY' })
  @IsOptional()
  @IsEnum(['ONE_WAY', 'ROUND_TRIP', 'RENTAL', 'OUTSTATION', 'AIRPORT_TRANSFER'])
  tripType?: TripType = 'ONE_WAY';

  @ApiProperty({ example: '100 Main St, New York, NY', description: 'Trip origin address' })
  @IsString()
  @IsNotEmpty()
  originAddress!: string;

  @ApiProperty({ example: 'JFK Airport Terminal 4, NY', description: 'Trip destination address' })
  @IsString()
  @IsNotEmpty()
  destinationAddress!: string;

  @ApiPropertyOptional({ example: 40.7128 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  originLatitude?: number;

  @ApiPropertyOptional({ example: -74.006 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  originLongitude?: number;

  @ApiPropertyOptional({ example: 40.6413 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLatitude?: number;

  @ApiPropertyOptional({ example: -73.7781 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLongitude?: number;

  @ApiProperty({ example: '2026-10-15T09:00:00.000Z', description: 'Scheduled start time' })
  @IsISO8601()
  scheduledStartTime!: string;

  @ApiPropertyOptional({ example: '2026-10-15T10:30:00.000Z', description: 'Scheduled end time' })
  @IsOptional()
  @IsISO8601()
  scheduledEndTime?: string;

  @ApiPropertyOptional({ example: 25.5, description: 'Estimated trip distance in km' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional({ example: 65.5, description: 'Fare amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fareAmount?: number;

  @ApiPropertyOptional({ example: 'Airport drop-off for flight AA123' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
