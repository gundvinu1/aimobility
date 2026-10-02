import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Customer requested cancellation', description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
