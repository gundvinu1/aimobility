import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'New role name (custom roles only)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[A-Za-z0-9_ -]{2,50}$/, { message: 'Role name must be between 2 and 50 characters (alphanumeric, spaces, hyphens, underscores)' })
  name?: string;

  @ApiPropertyOptional({ description: 'Updated role description' })
  @IsOptional()
  @IsString()
  description?: string;
}
