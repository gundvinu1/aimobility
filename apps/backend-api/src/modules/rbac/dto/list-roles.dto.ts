import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListRolesDto {
  @ApiPropertyOptional({ description: 'Filter by role name or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['PLATFORM', 'COMPANY'], description: 'Filter by scope' })
  @IsOptional()
  @IsEnum(['PLATFORM', 'COMPANY'])
  scope?: 'PLATFORM' | 'COMPANY';
}
