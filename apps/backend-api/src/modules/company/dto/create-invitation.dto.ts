import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyRole } from '@prisma/client';

export class CreateInvitationDto {
  @ApiProperty({ description: 'Email address to invite', example: 'newuser@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: CompanyRole, default: 'MEMBER', description: 'Role to assign on acceptance' })
  @IsOptional()
  @IsEnum(CompanyRole)
  role?: CompanyRole;
}
