import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { TripDirection } from '../../../generated/prisma/client';
import { DEPARTURE_TIME_PATTERN } from '../route.rules';

export class CreateRouteScheduleDto {
  @ApiProperty({ enum: TripDirection })
  @IsEnum(TripDirection)
  direction!: TripDirection;

  @ApiProperty({ example: '07:30' })
  @IsString()
  @Matches(DEPARTURE_TIME_PATTERN, { message: 'departure_time must be HH:mm' })
  departureTime!: string;

  @ApiProperty({ type: [Number], example: [1, 2, 3, 4, 5] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek!: number[];
}
