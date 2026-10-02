import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  EmploymentType,
  EmployeeGender,
  EmployeeDepartment,
} from '@ai-mos/types';

export class CreateEmployeeDto {
  // ─── Personal ─────────────────────────────────────────────────────────────

  @ApiProperty({ example: 'Ravi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Kumar' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ example: 'Ravi Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] })
  @IsOptional()
  @IsEnum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'])
  gender?: EmployeeGender;

  @ApiPropertyOptional({ example: '1990-06-15' })
  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string;

  // ─── Contact ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'ravi@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional({ example: '+917890123456' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternatePhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;

  // ─── Address ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  // ─── Employment ───────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    enum: ['OPERATIONS', 'DISPATCH', 'ACCOUNTS', 'HR', 'SALES', 'CUSTOMER_SUPPORT', 'ADMINISTRATION', 'MANAGEMENT', 'OTHER'],
  })
  @IsOptional()
  @IsEnum(['OPERATIONS', 'DISPATCH', 'ACCOUNTS', 'HR', 'SALES', 'CUSTOMER_SUPPORT', 'ADMINISTRATION', 'MANAGEMENT', 'OTHER'])
  department?: EmployeeDepartment;

  @ApiPropertyOptional({ example: 'Driver' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designation?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsISO8601()
  joiningDate!: string;

  @ApiPropertyOptional({ enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERN'], default: 'FULL_TIME' })
  @IsOptional()
  @IsEnum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERN'])
  employmentType?: EmploymentType;

  // ─── Emergency contact ────────────────────────────────────────────────────

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactRelation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
