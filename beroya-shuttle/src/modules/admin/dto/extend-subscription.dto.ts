import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class ExtendSubscriptionDto {
  @ApiProperty({ example: '2026-12-01T00:00:00.000Z' })
  @IsDateString()
  newEndDate!: string;
}
