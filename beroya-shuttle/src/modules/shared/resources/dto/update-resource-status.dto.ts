import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
  ResourceStatus,
  VehicleStatus,
} from '../../../../generated/prisma/client';

export class UpdateResourceStatusDto {
  @ApiProperty({ enum: ResourceStatus })
  @IsEnum(ResourceStatus)
  status!: ResourceStatus;
}

export class UpdateVehicleStatusDto {
  @ApiProperty({ enum: VehicleStatus })
  @IsEnum(VehicleStatus)
  status!: VehicleStatus;
}
