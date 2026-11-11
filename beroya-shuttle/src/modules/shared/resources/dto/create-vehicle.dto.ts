import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OwnerType } from '../../../../generated/prisma/client';
import { NestedDriverDto } from './nested-resource.dto';

export class CreateVehicleDto {
  @ApiProperty({ example: 'DAM-1234' })
  @IsString()
  @MinLength(3)
  plateNumber!: string;

  @ApiPropertyOptional({ example: 'bus' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(80)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @ApiPropertyOptional({
    enum: [OwnerType.BEROYA, OwnerType.DRIVER],
    description: 'Admin create only: Beroya-owned or driver-owned',
  })
  @IsOptional()
  @IsEnum(OwnerType)
  ownerType?: OwnerType;

  @ApiPropertyOptional({ description: 'Link Beroya vehicle/driver to a Beroya-operated institution' })
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional({ description: 'Existing owner/assigned driver' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ type: NestedDriverDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NestedDriverDto)
  newDriver?: NestedDriverDto;
}
