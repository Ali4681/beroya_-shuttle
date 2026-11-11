import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class LegalQueryDto {
  @ApiPropertyOptional({
    enum: ['ar', 'en'],
    description: 'Preferred locale. Falls back to X-Locale / Accept-Language, then ar.',
  })
  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: 'ar' | 'en';
}
