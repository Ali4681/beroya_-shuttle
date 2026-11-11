import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_RECENT_INSTITUTIONS } from '../insights.constants';

export class RecentInstitutionsQueryDto {
  @ApiPropertyOptional({ default: DEFAULT_RECENT_INSTITUTIONS, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = DEFAULT_RECENT_INSTITUTIONS;
}
