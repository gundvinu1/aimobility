import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRolePermissionsDto {
  @ApiProperty({
    description: 'Array of permission IDs or names to assign to the role (replaces existing assignments)',
    type: [String],
    example: ['vehicle.read', 'vehicle.create', 'driver.read'],
  })
  @IsArray()
  @IsString({ each: true })
  permissionIds!: string[];
}
