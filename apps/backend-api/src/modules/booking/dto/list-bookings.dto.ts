import { IsOptional, IsEnum, IsString, IsInt, Min, IsISO8601 } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { BookingStatus, BookingSource } from '@ai-mos/types';

export class ListBookingsDto {
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

  @ApiPropertyOptional({ description: 'Search by booking number, customer name, phone, or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
  status?: BookingStatus;

  @ApiPropertyOptional({ enum: ['WEB', 'MOBILE', 'ADMIN', 'PHONE', 'API'] })
  @IsOptional()
  @IsEnum(['WEB', 'MOBILE', 'ADMIN', 'PHONE', 'API'])
  source?: BookingSource;

  @ApiPropertyOptional({ description: 'From date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'To date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  toDate?: string;

  @ApiPropertyOptional({
    enum: ['bookingNumber', 'bookingDate', 'pickupTime', 'customerName', 'status', 'createdAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['bookingNumber', 'bookingDate', 'pickupTime', 'customerName', 'status', 'createdAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
