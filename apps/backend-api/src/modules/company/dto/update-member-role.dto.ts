import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'New role identifier (e.g. OWNER, ADMIN, MANAGER, DISPATCHER, ACCOUNTANT, DRIVER, or custom role name)',
    example: 'MANAGER',
  })
  @IsString()
  @IsNotEmpty()
  role!: string;
}
