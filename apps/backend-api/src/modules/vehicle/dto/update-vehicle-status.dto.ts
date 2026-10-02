import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { VehicleStatus } from '@ai-mos/types';

export class UpdateVehicleStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED', 'ON_TRIP'] })
  @IsEnum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED', 'ON_TRIP'])
  @IsNotEmpty()
  status!: VehicleStatus;
}
