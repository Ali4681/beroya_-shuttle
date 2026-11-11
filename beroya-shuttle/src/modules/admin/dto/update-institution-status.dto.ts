import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { InstitutionStatus } from '../../../generated/prisma/client';

export class UpdateInstitutionStatusDto {
  @ApiProperty({ enum: InstitutionStatus })
  @IsEnum(InstitutionStatus)
  status!: InstitutionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  reason?: string;
}
