import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TripDirection } from '../../../generated/prisma/client';

export class OptimizeStopsDto {
  @ApiPropertyOptional({ enum: TripDirection, default: TripDirection.OUTBOUND })
  @IsOptional()
  @IsEnum(TripDirection)
  direction?: TripDirection = TripDirection.OUTBOUND;
}
