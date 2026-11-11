import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StudentSubscriptionType } from '../../../generated/prisma/client';
import { GuardianDto } from './guardian.dto';
import { PickupDto } from './pickup.dto';

export class CreateStudentDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ enum: StudentSubscriptionType })
  @IsOptional()
  @IsEnum(StudentSubscriptionType)
  subscriptionType?: StudentSubscriptionType;

  @ApiProperty({ type: GuardianDto })
  @ValidateNested()
  @Type(() => GuardianDto)
  guardian!: GuardianDto;

  @ApiProperty({ type: PickupDto })
  @ValidateNested()
  @Type(() => PickupDto)
  pickup!: PickupDto;
}
