import {
  IsString,
  IsOptional,
  IsEnum,
  IsISO8601,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { TripType } from '@ai-mos/types';

export class UpdateTripDto {
  @ApiPropertyOptional({ enum: ['ONE_WAY', 'ROUND_TRIP', 'RENTAL', 'OUTSTATION', 'AIRPORT_TRANSFER'] })
  @IsOptional()
  @IsEnum(['ONE_WAY', 'ROUND_TRIP', 'RENTAL', 'OUTSTATION', 'AIRPORT_TRANSFER'])
  tripType?: TripType;

  @ApiPropertyOptional({ example: '100 Main St, New York, NY' })
  @IsOptional()
  @IsString()
  originAddress?: string;

  @ApiPropertyOptional({ example: 'JFK Airport Terminal 4, NY' })
  @IsOptional()
  @IsString()
  destinationAddress?: string;

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

  @ApiPropertyOptional({ example: '2026-10-15T09:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  scheduledStartTime?: string;

  @ApiPropertyOptional({ example: '2026-10-15T10:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  scheduledEndTime?: string;

  @ApiPropertyOptional({ example: 25.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional({ example: 65.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fareAmount?: number;

  @ApiPropertyOptional({ example: 12050 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  startOdometer?: number;

  @ApiPropertyOptional({ example: 12080 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  endOdometer?: number;

  @ApiPropertyOptional({ example: 'Updated route information' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
