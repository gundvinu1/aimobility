import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsEmail,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BookingSource } from '@ai-mos/types';

export class CreateBookingDto {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Customer user ID if registered' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({ example: 'Alice Johnson', description: 'Customer full name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName!: string;

  @ApiProperty({ example: '+1-555-0199', description: 'Customer phone number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  customerPhone!: string;

  @ApiPropertyOptional({ example: 'alice@example.com', description: 'Customer email' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  customerEmail?: string;

  @ApiProperty({ example: '100 Main St, New York, NY', description: 'Pickup address' })
  @IsString()
  @IsNotEmpty()
  pickupAddress!: string;

  @ApiProperty({ example: 'JFK Airport Terminal 4, NY', description: 'Dropoff address' })
  @IsString()
  @IsNotEmpty()
  dropoffAddress!: string;

  @ApiPropertyOptional({ example: 40.7128, description: 'Pickup latitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLatitude?: number;

  @ApiPropertyOptional({ example: -74.006, description: 'Pickup longitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLongitude?: number;

  @ApiPropertyOptional({ example: 40.6413, description: 'Dropoff latitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLatitude?: number;

  @ApiPropertyOptional({ example: -73.7781, description: 'Dropoff longitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLongitude?: number;

  @ApiProperty({ example: '2026-10-15T09:00:00.000Z', description: 'Scheduled pickup time' })
  @IsISO8601()
  pickupTime!: string;

  @ApiPropertyOptional({ example: 2, default: 1, description: 'Passenger count' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  passengerCount?: number = 1;

  @ApiPropertyOptional({ example: 25.5, description: 'Estimated distance in km' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedDistance?: number;

  @ApiPropertyOptional({ example: 45, description: 'Estimated duration in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedDuration?: number;

  @ApiPropertyOptional({ example: 75.0, description: 'Estimated fare' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedFare?: number;

  @ApiPropertyOptional({ enum: ['WEB', 'MOBILE', 'ADMIN', 'PHONE', 'API'], default: 'ADMIN' })
  @IsOptional()
  @IsEnum(['WEB', 'MOBILE', 'ADMIN', 'PHONE', 'API'])
  source?: BookingSource = 'ADMIN';

  @ApiPropertyOptional({ example: 'Requires child seat', description: 'Special instructions or notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
