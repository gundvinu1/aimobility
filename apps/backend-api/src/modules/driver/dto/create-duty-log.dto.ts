import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsISO8601,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DriverDutyStatus } from '@ai-mos/types';

export class CreateDutyLogDto {
  @ApiProperty({ enum: ['OFF_DUTY', 'ON_DUTY', 'ON_TRIP', 'ON_BREAK', 'UNAVAILABLE'] })
  @IsEnum(['OFF_DUTY', 'ON_DUTY', 'ON_TRIP', 'ON_BREAK', 'UNAVAILABLE'])
  @IsNotEmpty()
  status!: DriverDutyStatus;

  @ApiPropertyOptional({ example: '2026-10-01T08:00:00Z', description: 'Start time of duty' })
  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @ApiPropertyOptional({ example: '2026-10-01T17:00:00Z', description: 'End time of duty' })
  @IsOptional()
  @IsISO8601()
  endedAt?: string;

  @ApiPropertyOptional({ example: 'Regular morning shift', description: 'Duty notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
