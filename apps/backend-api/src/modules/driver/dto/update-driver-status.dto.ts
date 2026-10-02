import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { DriverStatus } from '@ai-mos/types';

export class UpdateDriverStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'] })
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'])
  @IsNotEmpty()
  status!: DriverStatus;
}
