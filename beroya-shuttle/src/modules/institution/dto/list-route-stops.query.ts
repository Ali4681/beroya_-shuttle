import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TripDirection } from '../../../generated/prisma/client';

export class ListRouteStopsQueryDto {
  @ApiPropertyOptional({ enum: TripDirection, default: TripDirection.OUTBOUND })
  @IsOptional()
  @IsEnum(TripDirection)
  direction?: TripDirection = TripDirection.OUTBOUND;
}
