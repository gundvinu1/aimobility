import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DispatchTripDto {
  @ApiPropertyOptional({ example: 'Dispatched from central depot' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
