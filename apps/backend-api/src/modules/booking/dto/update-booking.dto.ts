import {
  IsString,
  IsOptional,
  IsISO8601,
  IsInt,
  IsNumber,
  IsEmail,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBookingDto {
  @ApiPropertyOptional({ example: 'Alice Johnson' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;

  @ApiPropertyOptional({ example: '+1-555-0199' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string;

  @ApiPropertyOptional({ example: 'alice@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  customerEmail?: string;

  @ApiPropertyOptional({ example: '100 Main St, New York, NY' })
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiPropertyOptional({ example: 'JFK Airport Terminal 4, NY' })
  @IsOptional()
  @IsString()
  dropoffAddress?: string;

  @ApiPropertyOptional({ example: 40.7128 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLatitude?: number;

  @ApiPropertyOptional({ example: -74.006 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLongitude?: number;

  @ApiPropertyOptional({ example: 40.6413 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLatitude?: number;

  @ApiPropertyOptional({ example: -73.7781 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLongitude?: number;

  @ApiPropertyOptional({ example: '2026-10-15T09:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  pickupTime?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  passengerCount?: number;

  @ApiPropertyOptional({ example: 25.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedDistance?: number;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedDuration?: number;

  @ApiPropertyOptional({ example: 75.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedFare?: number;

  @ApiPropertyOptional({ example: 80.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualFare?: number;

  @ApiPropertyOptional({ example: 'Updated passenger notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
