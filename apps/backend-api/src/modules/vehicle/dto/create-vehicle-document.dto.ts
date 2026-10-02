import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsISO8601,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { VehicleDocumentType } from '@ai-mos/types';

export class CreateVehicleDocumentDto {
  @ApiProperty({ enum: ['REGISTRATION_CERTIFICATE', 'INSURANCE', 'POLLUTION_CERTIFICATE', 'FITNESS_CERTIFICATE', 'PERMIT', 'TAX_TOKEN', 'OTHER'] })
  @IsEnum(['REGISTRATION_CERTIFICATE', 'INSURANCE', 'POLLUTION_CERTIFICATE', 'FITNESS_CERTIFICATE', 'PERMIT', 'TAX_TOKEN', 'OTHER'])
  @IsNotEmpty()
  documentType!: VehicleDocumentType;

  @ApiProperty({ example: 'Vehicle Insurance Policy' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'POL-2024-98765' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsISO8601()
  issuedAt?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
