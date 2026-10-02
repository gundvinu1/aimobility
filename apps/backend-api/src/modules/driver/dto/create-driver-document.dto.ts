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
import type { DriverDocumentType } from '@ai-mos/types';

export class CreateDriverDocumentDto {
  @ApiProperty({
    enum: [
      'DRIVING_LICENSE',
      'BADGE',
      'POLICE_VERIFICATION',
      'MEDICAL_CERTIFICATE',
      'IDENTITY_PROOF',
      'ADDRESS_PROOF',
      'OTHER',
    ],
  })
  @IsEnum([
    'DRIVING_LICENSE',
    'BADGE',
    'POLICE_VERIFICATION',
    'MEDICAL_CERTIFICATE',
    'IDENTITY_PROOF',
    'ADDRESS_PROOF',
    'OTHER',
  ])
  @IsNotEmpty()
  documentType!: DriverDocumentType;

  @ApiPropertyOptional({ example: 'DOC-123456', description: 'Document identification number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Issue date' })
  @IsOptional()
  @IsISO8601()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Expiry date' })
  @IsOptional()
  @IsISO8601()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'https://storage.example.com/docs/license.pdf' })
  @IsOptional()
  @IsUrl()
  fileUrl?: string;

  @ApiPropertyOptional({ description: 'Notes about the document' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
