import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ResourceStatus } from '../../../generated/prisma/client';

export class UpdateBranchStatusDto {
  @ApiProperty({ enum: ResourceStatus })
  @IsEnum(ResourceStatus)
  status!: ResourceStatus;
}
