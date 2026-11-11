import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { TripDirection } from '../../../generated/prisma/client';

export class StopOrderItemDto {
  @ApiProperty()
  @IsUUID()
  stopId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  sequence!: number;
}

export class StopOrderDto {
  @ApiProperty({ enum: TripDirection })
  @IsEnum(TripDirection)
  direction!: TripDirection;

  @ApiProperty({ type: [StopOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StopOrderItemDto)
  stops!: StopOrderItemDto[];
}
