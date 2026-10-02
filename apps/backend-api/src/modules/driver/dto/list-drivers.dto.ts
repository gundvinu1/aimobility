import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { DriverStatus, DriverDutyStatus, LicenseType } from '@ai-mos/types';

export class ListDriversDto {
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

  @ApiPropertyOptional({ description: 'Search by driver code, license number, or employee name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'])
  status?: DriverStatus;

  @ApiPropertyOptional({ enum: ['OFF_DUTY', 'ON_DUTY', 'ON_TRIP', 'ON_BREAK', 'UNAVAILABLE'] })
  @IsOptional()
  @IsEnum(['OFF_DUTY', 'ON_DUTY', 'ON_TRIP', 'ON_BREAK', 'UNAVAILABLE'])
  dutyStatus?: DriverDutyStatus;

  @ApiPropertyOptional({ enum: ['LMV', 'HMV', 'COMMERCIAL', 'TRANSPORT', 'OTHER'] })
  @IsOptional()
  @IsEnum(['LMV', 'HMV', 'COMMERCIAL', 'TRANSPORT', 'OTHER'])
  licenseType?: LicenseType;

  @ApiPropertyOptional({ description: 'Filter licenses expiring within N days (e.g. 30)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  licenseExpiringDays?: number;

  @ApiPropertyOptional({
    enum: [
      'driverCode',
      'licenseNumber',
      'licenseExpiryDate',
      'experienceYears',
      'joiningDate',
      'status',
      'dutyStatus',
      'createdAt',
    ],
  })
  @IsOptional()
  @IsEnum([
    'driverCode',
    'licenseNumber',
    'licenseExpiryDate',
    'experienceYears',
    'joiningDate',
    'status',
    'dutyStatus',
    'createdAt',
  ])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
