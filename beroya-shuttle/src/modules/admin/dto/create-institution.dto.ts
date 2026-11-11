import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PHONE_PATTERN } from '../../../common/utils/phone';
import {
  InstitutionType,
  OperationModel,
} from '../../../generated/prisma/client';

export class InstitutionAdminDto {
  @ApiProperty({ example: 'Omar Institution Admin' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: '+963911111111' })
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiProperty({ example: 'admin@school.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class DefaultBranchDto {
  @ApiPropertyOptional({ example: 'Main' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class CreateInstitutionDto {
  @ApiProperty({ example: 'Al Houssein School' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ enum: InstitutionType })
  @IsEnum(InstitutionType)
  type!: InstitutionType;

  @ApiPropertyOptional({ enum: OperationModel })
  @IsOptional()
  @IsEnum(OperationModel)
  operationModel?: OperationModel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 'حلب' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ type: InstitutionAdminDto })
  @ValidateNested()
  @Type(() => InstitutionAdminDto)
  admin!: InstitutionAdminDto;

  @ApiPropertyOptional({ type: DefaultBranchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DefaultBranchDto)
  defaultBranch?: DefaultBranchDto;
}
