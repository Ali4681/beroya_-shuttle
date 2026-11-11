import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_EXPIRING_DAYS } from '../insights.constants';

export class ExpiringSubscriptionsQueryDto {
  @ApiPropertyOptional({ default: DEFAULT_EXPIRING_DAYS, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = DEFAULT_EXPIRING_DAYS;
}
