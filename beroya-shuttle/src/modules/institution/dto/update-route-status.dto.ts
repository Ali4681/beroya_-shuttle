import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { RouteStatus } from '../../../generated/prisma/client';

export class UpdateRouteStatusDto {
  @ApiProperty({ enum: RouteStatus })
  @IsEnum(RouteStatus)
  status!: RouteStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  notifyUsers?: boolean;
}
