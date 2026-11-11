import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { LocationPingDto } from './location-ping.dto';

export class LocationBatchDto {
  @ApiProperty({ type: [LocationPingDto] })
  @ValidateNested({ each: true })
  @Type(() => LocationPingDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  pings!: LocationPingDto[];
}
