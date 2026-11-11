import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional } from 'class-validator';
import { ARRIVAL_MINUTES } from '../../notifications/arrival-alert.rules';

export class ArrivalPreferenceDto {
  @ApiProperty({ enum: ARRIVAL_MINUTES, example: 10 })
  @IsInt()
  @IsIn([...ARRIVAL_MINUTES])
  minutesBefore!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;
}
