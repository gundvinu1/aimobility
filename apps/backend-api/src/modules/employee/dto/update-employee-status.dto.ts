import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { EmploymentStatus } from '@ai-mos/types';

export class UpdateEmployeeStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'] })
  @IsEnum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'])
  employmentStatus!: EmploymentStatus;
}
