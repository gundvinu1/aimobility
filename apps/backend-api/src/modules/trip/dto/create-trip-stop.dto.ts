import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  MaxLength,
  IsDateString,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { STOP_TYPE, type StopTypeValue } from '@ai-mos/constants';

export class CreateTripStopDto {
  @ApiProperty({ example: 'Airport Terminal 2', description: 'Name or description of the stop' })
  @IsString()
  @MaxLength(255)
  locationName!: string;

  @ApiPropertyOptional({ example: '123 Airport Way, City', description: 'Street address' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({ example: 37.7749, description: 'Latitude coordinate' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -122.4194, description: 'Longitude coordinate' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ enum: STOP_TYPE, default: 'WAYPOINT', description: 'Stop classification' })
  @IsOptional()
  @IsEnum(STOP_TYPE)
  stopType?: StopTypeValue;

  @ApiPropertyOptional({ example: 1, description: 'Execution sequence order (1-indexed)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  stopOrder?: number;

  @ApiPropertyOptional({ example: '2026-10-15T09:30:00Z', description: 'Planned arrival ISO timestamp' })
  @IsOptional()
  @IsDateString()
  plannedArrival?: string;

  @ApiPropertyOptional({ example: '2026-10-15T09:45:00Z', description: 'Planned departure ISO timestamp' })
  @IsOptional()
  @IsDateString()
  plannedDeparture?: string;

  @ApiPropertyOptional({ example: 'John Doe', description: 'Passenger name at this stop' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  passengerName?: string;

  @ApiPropertyOptional({ example: '+15551234567', description: 'Passenger phone contact' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  passengerPhone?: string;

  @ApiPropertyOptional({ example: 'Ring bell on arrival', description: 'Driver notes for stop' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
