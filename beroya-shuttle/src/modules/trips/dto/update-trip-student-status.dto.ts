import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TripStudentStatus } from '../../../generated/prisma/client';

export class UpdateTripStudentStatusDto {
  @ApiProperty({ enum: TripStudentStatus })
  @IsEnum(TripStudentStatus)
  status!: TripStudentStatus;
}
