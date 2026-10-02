import { IsNotEmpty, IsString, IsOptional, IsEnum, IsInt, Min, Max, IsArray, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateRoleDto {
  @ApiProperty({ description: 'Unique role name (e.g. FLEET_SUPERVISOR or Fleet Supervisor)', example: 'FLEET_SUPERVISOR' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[A-Za-z0-9_ -]{2,50}$/, { message: 'Role name must be between 2 and 50 characters (alphanumeric, spaces, hyphens, underscores)' })
  name!: string;

  @ApiPropertyOptional({ description: 'Detailed description of the role' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['PLATFORM', 'COMPANY'], default: 'COMPANY' })
  @IsOptional()
  @IsEnum(['PLATFORM', 'COMPANY'])
  scope?: 'PLATFORM' | 'COMPANY';

  @ApiPropertyOptional({ description: 'Hierarchy level (1-99 for custom roles)', default: 35 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  level?: number;

  @ApiPropertyOptional({ description: 'List of permission IDs or names to assign to this role', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];
}
