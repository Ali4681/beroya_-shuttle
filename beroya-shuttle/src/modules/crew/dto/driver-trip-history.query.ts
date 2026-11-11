import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TripStatus } from '../../../generated/prisma/client';

export class DriverTripHistoryQueryDto {
  @ApiProperty({
    example: '2026-09-28',
    description: 'Inclusive start YYYY-MM-DD (invalid → INVALID_DATE)',
  })
  @IsString()
  from!: string;

  @ApiProperty({
    example: '2026-10-04',
    description: 'Inclusive end YYYY-MM-DD (invalid → INVALID_DATE)',
  })
  @IsString()
  to!: string;

  @ApiPropertyOptional({
    description:
      'Trip status filter. Single value or comma-separated list (COMPLETED,CANCELLED,...)',
    example: 'COMPLETED,CANCELLED',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') {
      return undefined;
    }
    const raw = Array.isArray(value) ? value.join(',') : String(value);
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  })
  @IsEnum(TripStatus, { each: true })
  status?: TripStatus[];

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
