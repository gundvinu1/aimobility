import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { STOP_TYPE, STOP_STATUS, type StopTypeValue, type StopStatusValue } from '@ai-mos/constants';

export class UpdateTripStopDto {
  @ApiPropertyOptional({ example: 'Airport Terminal 2', description: 'Name or description of the stop' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationName?: string;

  @ApiPropertyOptional({ example: '123 Airport Way, City', description: 'Street address' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 37.7749, description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -122.4194, description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ enum: STOP_TYPE, description: 'Stop classification' })
  @IsOptional()
  @IsEnum(STOP_TYPE)
  stopType?: StopTypeValue;

  @ApiPropertyOptional({ example: '2026-10-15T09:30:00Z', description: 'Planned arrival ISO timestamp' })
  @IsOptional()
  @IsDateString()
  plannedArrival?: string;

  @ApiPropertyOptional({ example: '2026-10-15T09:45:00Z', description: 'Planned departure ISO timestamp' })
  @IsOptional()
  @IsDateString()
  plannedDeparture?: string;

  @ApiPropertyOptional({ example: '2026-10-15T09:32:00Z', description: 'Actual arrival ISO timestamp' })
  @IsOptional()
  @IsDateString()
  actualArrival?: string;

  @ApiPropertyOptional({ example: '2026-10-15T09:42:00Z', description: 'Actual departure ISO timestamp' })
  @IsOptional()
  @IsDateString()
  actualDeparture?: string;

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

  @ApiPropertyOptional({ example: 'Passenger boarded', description: 'Driver notes for stop' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ enum: STOP_STATUS, description: 'Stop execution status' })
  @IsOptional()
  @IsEnum(STOP_STATUS)
  status?: StopStatusValue;
}
