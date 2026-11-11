import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { TripDirection } from '../../../generated/prisma/client';

export const UNIVERSITY_CROWD_BANDS = ['low', 'medium', 'high'] as const;
export type UniversityCrowdBand = (typeof UNIVERSITY_CROWD_BANDS)[number];

export class UniversityTripsQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-08',
    description: 'Service date YYYY-MM-DD (institution TZ calendar). Defaults to today.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({ enum: TripDirection })
  @IsOptional()
  @IsEnum(TripDirection)
  direction?: TripDirection;

  @ApiPropertyOptional({ description: 'Only trips on this route' })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional({
    description:
      'User latitude — when set with lng, each trip includes nearest_stop_distance_meters',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ description: 'User longitude (pair with lat)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({
    description:
      'When lat/lng set, drop trips whose nearest stop is farther than this (meters)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxDistanceMeters?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Keep trips with eta_minutes <= this value (null ETA excluded)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxEtaMinutes?: number;

  @ApiPropertyOptional({
    example: 20,
    description:
      'Keep trips with eta_minutes >= this value — e.g. over 20 → min_eta_minutes=20 (null ETA excluded)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minEtaMinutes?: number;

  @ApiPropertyOptional({
    enum: UNIVERSITY_CROWD_BANDS,
    description:
      'Occupancy band: low <0.45, medium <0.75, high ≥0.75 (boarded_count/capacity). Trips without capacity excluded.',
  })
  @IsOptional()
  @IsIn(UNIVERSITY_CROWD_BANDS)
  crowd?: UniversityCrowdBand;
}
