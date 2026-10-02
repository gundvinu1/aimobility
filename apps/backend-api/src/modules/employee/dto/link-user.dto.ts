import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkEmployeeUserDto {
  @ApiProperty({
    description: 'Platform User ID to associate with this employee',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  @IsNotEmpty()
  userId!: string;
}
