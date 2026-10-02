import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { EmploymentStatus, EmploymentType, EmployeeDepartment } from '@ai-mos/types';

export class ListEmployeesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search by name, email, phone or employeeNumber' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'])
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({ enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERN'] })
  @IsOptional()
  @IsEnum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERN'])
  employmentType?: EmploymentType;

  @ApiPropertyOptional({
    enum: ['OPERATIONS', 'DISPATCH', 'ACCOUNTS', 'HR', 'SALES', 'CUSTOMER_SUPPORT', 'ADMINISTRATION', 'MANAGEMENT', 'OTHER'],
  })
  @IsOptional()
  @IsEnum(['OPERATIONS', 'DISPATCH', 'ACCOUNTS', 'HR', 'SALES', 'CUSTOMER_SUPPORT', 'ADMINISTRATION', 'MANAGEMENT', 'OTHER'])
  department?: EmployeeDepartment;

  @ApiPropertyOptional({
    enum: ['firstName', 'lastName', 'employeeNumber', 'joiningDate', 'createdAt', 'employmentStatus', 'department'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
