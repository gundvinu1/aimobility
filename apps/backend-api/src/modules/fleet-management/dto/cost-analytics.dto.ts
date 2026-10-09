import { IsUUID, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryFleetCostsDto {
  @ApiPropertyOptional({ description: 'Filter by specific vehicle' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Start date filter (ISO)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Predefined range preset',
    enum: ['today', '7d', '30d', 'this_month', 'custom'],
    default: '30d',
  })
  @IsOptional()
  @IsString()
  range?: string;
}
