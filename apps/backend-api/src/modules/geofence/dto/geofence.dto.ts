import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { GeofenceGeometry, GeofenceType } from '@ai-mos/types';

export class CreateGeofenceDto {
  @ApiProperty({ example: 'Downtown Zone', description: 'Name of the geofence' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Commercial district operational area' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['CIRCLE', 'POLYGON'], example: 'CIRCLE' })
  @IsEnum(['CIRCLE', 'POLYGON'])
  type!: GeofenceType;

  @ApiProperty({
    description: 'Geometry definition ({ center, radiusMeters } or { coordinates })',
    example: { center: { latitude: 37.7749, longitude: -122.4194 }, radiusMeters: 500 },
  })
  @IsNotEmpty()
  geometry!: GeofenceGeometry;

  @ApiPropertyOptional({ example: '#3b82f6', default: '#3b82f6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  entryAlertEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  exitAlertEnabled?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Optional list of vehicle UUIDs to assign' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vehicleIds?: string[];
}

export class UpdateGeofenceDto {
  @ApiPropertyOptional({ example: 'Downtown Zone' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['CIRCLE', 'POLYGON'] })
  @IsOptional()
  @IsEnum(['CIRCLE', 'POLYGON'])
  type?: GeofenceType;

  @ApiPropertyOptional()
  @IsOptional()
  geometry?: GeofenceGeometry;

  @ApiPropertyOptional({ example: '#ef4444' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  entryAlertEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  exitAlertEnabled?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vehicleIds?: string[];
}

export class AssignVehiclesDto {
  @ApiProperty({ type: [String], description: 'Array of vehicle UUIDs to assign' })
  @IsArray()
  @IsUUID('4', { each: true })
  vehicleIds!: string[];
}

export class ListGeofencesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search by geofence name' })
  @IsOptional()
  @IsString()
  search?: string;
}
