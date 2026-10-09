import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UnassignDriverDto {
  @ApiPropertyOptional({ example: 'Driver called in sick', description: 'Reason for unassigning driver' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
