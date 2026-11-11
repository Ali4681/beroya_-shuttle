import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { NotificationAudience } from '../../../generated/prisma/client';

export class AudiencePreviewDto {
  @ApiProperty({ enum: NotificationAudience })
  @IsEnum(NotificationAudience)
  audience!: NotificationAudience;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  routeId?: string;
}
