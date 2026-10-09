import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UnassignVehicleDto {
  @ApiPropertyOptional({ example: 'Vehicle scheduled for service', description: 'Reason for unassigning vehicle' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
