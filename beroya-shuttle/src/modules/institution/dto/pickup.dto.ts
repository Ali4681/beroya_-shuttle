import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PickupType } from '../../../generated/prisma/client';

export class PickupDto {
  @ApiProperty({ enum: PickupType })
  @IsEnum(PickupType)
  pickupType!: PickupType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  meetingPointId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLabel?: string;
}
