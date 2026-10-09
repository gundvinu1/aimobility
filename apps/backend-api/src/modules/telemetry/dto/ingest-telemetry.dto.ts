import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
  IsUUID,
  IsEnum,
  IsISO8601,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TelemetrySource } from '@prisma/client';

export class IngestTelemetryDto {
  @ApiProperty({ description: 'Vehicle UUID' })
  @IsUUID('4')
  vehicleId!: string;

  @ApiPropertyOptional({ description: 'Driver UUID (optional)' })
  @IsOptional()
  @IsUUID('4')
  driverId?: string;

  @ApiProperty({ description: 'Latitude (-90 to 90)', minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ description: 'Longitude (-180 to 180)', minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ description: 'Speed in km/h', minimum: 0, maximum: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  speed?: number;

  @ApiPropertyOptional({ description: 'Heading in degrees (0-360)', minimum: 0, maximum: 360 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({ description: 'GPS accuracy in metres', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional({ description: 'Altitude in metres' })
  @IsOptional()
  @IsNumber()
  altitude?: number;

  @ApiPropertyOptional({ description: 'Vehicle ignition status' })
  @IsOptional()
  @IsBoolean()
  ignition?: boolean;

  @ApiPropertyOptional({ description: 'Battery level percentage (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @ApiPropertyOptional({ description: 'Odometer reading in km', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  odometer?: number;

  @ApiPropertyOptional({ description: 'Engine temperature in celsius' })
  @IsOptional()
  @IsNumber()
  engineTemperature?: number;

  @ApiPropertyOptional({ description: 'Fuel level percentage (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fuelLevel?: number;

  @ApiPropertyOptional({ description: 'Signal strength (dBm or percentage)' })
  @IsOptional()
  @IsNumber()
  signalStrength?: number;

  @ApiPropertyOptional({
    enum: TelemetrySource,
    description: 'Source of the telemetry event',
    default: TelemetrySource.API,
  })
  @IsOptional()
  @IsEnum(TelemetrySource)
  source?: TelemetrySource;

  @ApiProperty({ description: 'Event timestamp (ISO 8601)' })
  @IsISO8601()
  timestamp!: string;
}

export class ListTelemetryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (max 500)', default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Start datetime (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End datetime (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: TelemetrySource })
  @IsOptional()
  @IsEnum(TelemetrySource)
  source?: TelemetrySource;
}
