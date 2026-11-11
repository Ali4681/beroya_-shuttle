import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DriverWeeklyStatsQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-28',
    description:
      'Week start YYYY-MM-DD (invalid → INVALID_DATE). Defaults to the current Sunday–Saturday week in the institution timezone.',
  })
  @IsOptional()
  @IsString()
  weekStart?: string;
}
