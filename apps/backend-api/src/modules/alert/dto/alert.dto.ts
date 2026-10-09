import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsUUID,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type {
  FleetAlertType,
  FleetAlertSeverity,
  FleetAlertStatus,
} from '@ai-mos/types';

export class QueryAlertsDto {
  @ApiPropertyOptional({ enum: ['GEOFENCE_ENTRY', 'GEOFENCE_EXIT', 'OVERSPEED', 'HARSH_BRAKING', 'EXCESSIVE_IDLE'] })
  @IsOptional()
  @IsEnum(['GEOFENCE_ENTRY', 'GEOFENCE_EXIT', 'OVERSPEED', 'HARSH_BRAKING', 'EXCESSIVE_IDLE'])
  type?: FleetAlertType;

  @ApiPropertyOptional({ enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsEnum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: FleetAlertSeverity;

  @ApiPropertyOptional({ enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] })
  @IsOptional()
  @IsEnum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'])
  status?: FleetAlertStatus;

  @ApiPropertyOptional({ description: 'Filter by vehicle UUID' })
  @IsOptional()
  @IsUUID('4')
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Filter by driver UUID' })
  @IsOptional()
  @IsUUID('4')
  driverId?: string;

  @ApiPropertyOptional({ description: 'Filter by geofence UUID' })
  @IsOptional()
  @IsUUID('4')
  geofenceId?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO string)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO string)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Search title or message' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class UpdateAlertStatusDto {
  @ApiPropertyOptional({ example: 'Investigated by fleet dispatcher' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCompanyAlertConfigDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  overspeedEnabled?: boolean;

  @ApiPropertyOptional({ example: 80.0, description: 'Speed limit in km/h' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(250)
  overspeedThresholdKmH?: number;

  @ApiPropertyOptional({ example: 10, description: 'Grace period in seconds' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  overspeedGracePeriodSeconds?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  harshBrakingEnabled?: boolean;

  @ApiPropertyOptional({ example: 20.0, description: 'Deceleration in km/h per second' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(100)
  harshBrakingThresholdKmhPerSec?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  excessiveIdleEnabled?: boolean;

  @ApiPropertyOptional({ example: 15, description: 'Idle threshold in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  excessiveIdleThresholdMinutes?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  geofenceEntryAlertsEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  geofenceExitAlertsEnabled?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Enable sudden fuel drop alerts' })
  @IsOptional()
  @IsBoolean()
  fuelDropEnabled?: boolean;

  @ApiPropertyOptional({ example: 10.0, description: 'Fuel drop threshold in liters' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  fuelDropThresholdLiters?: number;

  @ApiPropertyOptional({ default: true, description: 'Enable preventive maintenance alerts' })
  @IsOptional()
  @IsBoolean()
  maintenanceAlertsEnabled?: boolean;
}
