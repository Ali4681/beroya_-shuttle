import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class AttendantBoardedDto {
  @ApiPropertyOptional({
    default: true,
    description:
      'true = confirm attendant boarded; false = clear confirmation (allowed while SCHEDULED or IN_PROGRESS)',
  })
  @IsOptional()
  @IsBoolean()
  boarded?: boolean;
}
