import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderTripStopsDto {
  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174002'],
    description: 'Ordered array of trip stop IDs representing desired sequence',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  stopIds!: string[];
}
