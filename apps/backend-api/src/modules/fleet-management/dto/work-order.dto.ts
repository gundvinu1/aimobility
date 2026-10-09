import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import type { WorkOrderPriority, WorkOrderStatus, WorkOrderItemType } from '@ai-mos/types';

export class WorkOrderItemInputDto {
  @ApiPropertyOptional({ enum: ['PARTS', 'LABOR', 'OTHER'], default: 'PARTS' })
  @IsOptional()
  @IsEnum(['PARTS', 'LABOR', 'OTHER'] as const)
  itemType?: WorkOrderItemType;

  @ApiProperty({ description: 'Line item description', example: 'OEM Oil Filter' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'Item quantity or hours', example: 1 })
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiProperty({ description: 'Unit cost', example: 15.5 })
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreateWorkOrderDto {
  @ApiProperty({ description: 'Target vehicle ID' })
  @IsUUID()
  vehicleId!: string;

  @ApiPropertyOptional({ description: 'Optional assigned service center / vendor ID' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Optional preventive maintenance schedule ID' })
  @IsOptional()
  @IsUUID()
  scheduleId?: string;

  @ApiProperty({ description: 'Work order title', example: '50,000 km Scheduled Service & Brake Check' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Detailed work order scope and instructions' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)
  priority?: WorkOrderPriority;

  @ApiPropertyOptional({ description: 'Assigned mechanic or technician name' })
  @IsOptional()
  @IsString()
  assignedTechnician?: string;

  @ApiPropertyOptional({ description: 'Estimated total cost', example: 350.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @ApiPropertyOptional({ type: [WorkOrderItemInputDto], description: 'Line items for parts and labor' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkOrderItemInputDto)
  items?: WorkOrderItemInputDto[];

  @ApiPropertyOptional({ description: 'Internal remarks or notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWorkOrderDto extends PartialType(CreateWorkOrderDto) {}

export class UpdateWorkOrderStatusDto {
  @ApiProperty({ enum: ['DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @IsEnum(['DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const)
  status!: WorkOrderStatus;

  @ApiPropertyOptional({ description: 'Final actual cost upon completion', example: 345.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCost?: number;

  @ApiPropertyOptional({ description: 'Status change or resolution remarks' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryWorkOrdersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const)
  status?: WorkOrderStatus;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)
  priority?: WorkOrderPriority;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
