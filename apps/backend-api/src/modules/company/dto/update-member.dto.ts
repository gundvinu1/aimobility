import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyRole, MembershipStatus } from '@prisma/client';

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: CompanyRole, description: 'New company role' })
  @IsOptional()
  @IsEnum(CompanyRole)
  role?: CompanyRole;

  @ApiPropertyOptional({ enum: MembershipStatus, description: 'New membership status' })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
