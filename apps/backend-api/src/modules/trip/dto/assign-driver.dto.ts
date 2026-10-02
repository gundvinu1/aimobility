import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignDriverDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Driver ID to assign' })
  @IsUUID()
  driverId!: string;

  @ApiPropertyOptional({ example: 'Assigned for morning airport run' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
