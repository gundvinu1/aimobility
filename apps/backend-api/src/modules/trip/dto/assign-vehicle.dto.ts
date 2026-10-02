import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignVehicleDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Vehicle ID to assign' })
  @IsUUID()
  vehicleId!: string;

  @ApiPropertyOptional({ example: 'Assigned Toyota Camry' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
