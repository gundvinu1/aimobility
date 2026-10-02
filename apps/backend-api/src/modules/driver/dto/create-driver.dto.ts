import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsISO8601,
  IsInt,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DriverStatus, DriverDutyStatus, LicenseType } from '@ai-mos/types';

export class CreateDriverDto {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Linked employee ID' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiProperty({ example: 'DRV-001', description: 'Unique driver code within company' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  driverCode!: string;

  @ApiProperty({ example: 'DL-1420110012345', description: 'Driving license number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  licenseNumber!: string;

  @ApiPropertyOptional({ enum: ['LMV', 'HMV', 'COMMERCIAL', 'TRANSPORT', 'OTHER'], default: 'COMMERCIAL' })
  @IsOptional()
  @IsEnum(['LMV', 'HMV', 'COMMERCIAL', 'TRANSPORT', 'OTHER'])
  licenseType?: LicenseType;

  @ApiPropertyOptional({ example: '2020-01-15', description: 'License issue date' })
  @IsOptional()
  @IsISO8601()
  licenseIssueDate?: string;

  @ApiProperty({ example: '2028-01-15', description: 'License expiry date' })
  @IsISO8601()
  licenseExpiryDate!: string;

  @ApiPropertyOptional({ example: 'RTO Delhi West', description: 'Issuing authority' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseIssuingAuthority?: string;

  @ApiPropertyOptional({ example: 'BDG-9876', description: 'Commercial driver badge number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  badgeNumber?: string;

  @ApiPropertyOptional({ example: '2027-06-30', description: 'Badge expiry date' })
  @IsOptional()
  @IsISO8601()
  badgeExpiryDate?: string;

  @ApiPropertyOptional({ example: 5, description: 'Years of driving experience' })
  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @ApiPropertyOptional({ example: 'O+', description: 'Blood group' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  bloodGroup?: string;

  @ApiPropertyOptional({ example: 'Jane Doe', description: 'Emergency contact name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Emergency contact phone' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'], default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'])
  status?: DriverStatus;

  @ApiPropertyOptional({ enum: ['OFF_DUTY', 'ON_DUTY', 'ON_TRIP', 'ON_BREAK', 'UNAVAILABLE'], default: 'OFF_DUTY' })
  @IsOptional()
  @IsEnum(['OFF_DUTY', 'ON_DUTY', 'ON_TRIP', 'ON_BREAK', 'UNAVAILABLE'])
  dutyStatus?: DriverDutyStatus;

  @ApiPropertyOptional({ example: '2023-05-01', description: 'Joining date' })
  @IsOptional()
  @IsISO8601()
  joiningDate?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
