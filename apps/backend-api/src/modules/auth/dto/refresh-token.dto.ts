import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token received at login' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
