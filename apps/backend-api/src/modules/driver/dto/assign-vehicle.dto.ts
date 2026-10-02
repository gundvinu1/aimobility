import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignVehicleDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Vehicle ID to assign' })
  @IsUUID()
  @IsNotEmpty()
  vehicleId!: string;

  @ApiPropertyOptional({ example: 'Assigned for regional distribution routes', description: 'Assignment notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
