import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from '../insights.constants';

export class InstitutionSearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ default: DEFAULT_SEARCH_LIMIT, minimum: 1, maximum: MAX_SEARCH_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_LIMIT)
  limit = DEFAULT_SEARCH_LIMIT;
}

export class AdminSearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: DEFAULT_SEARCH_LIMIT, minimum: 1, maximum: MAX_SEARCH_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_LIMIT)
  limit = DEFAULT_SEARCH_LIMIT;
}
