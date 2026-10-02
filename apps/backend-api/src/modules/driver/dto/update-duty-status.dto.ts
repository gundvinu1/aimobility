import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DriverDutyStatus } from '@ai-mos/types';

export class UpdateDutyStatusDto {
  @ApiProperty({ enum: ['OFF_DUTY', 'ON_DUTY', 'ON_TRIP', 'ON_BREAK', 'UNAVAILABLE'] })
  @IsEnum(['OFF_DUTY', 'ON_DUTY', 'ON_TRIP', 'ON_BREAK', 'UNAVAILABLE'])
  @IsNotEmpty()
  dutyStatus!: DriverDutyStatus;

  @ApiPropertyOptional({ example: 'Shift start / regular duty', description: 'Duty log notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
