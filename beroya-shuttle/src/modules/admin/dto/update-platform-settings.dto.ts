import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PHONE_PATTERN } from '../../../common/utils/phone';

const SEMVER = /^\d+\.\d+\.\d+$/;
const URL_OR_EMPTY = /^(https?:\/\/.+)?$/i;

function Version() {
  return function (target: object, propertyKey: string) {
    IsOptional()(target, propertyKey);
    IsString()(target, propertyKey);
    Matches(SEMVER)(target, propertyKey);
  };
}

function StoreUrl() {
  return function (target: object, propertyKey: string) {
    IsOptional()(target, propertyKey);
    ValidateIf((_, value) => value != null && value !== '')(target, propertyKey);
    IsString()(target, propertyKey);
    Matches(URL_OR_EMPTY)(target, propertyKey);
  };
}

function Message() {
  return function (target: object, propertyKey: string) {
    IsOptional()(target, propertyKey);
    IsString()(target, propertyKey);
    MaxLength(500)(target, propertyKey);
  };
}

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({ example: '+963944000111', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  supportPhone?: string | null;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(600)
  gpsStaleAfterSeconds?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  locationPingIntervalSeconds?: number;

  @ApiPropertyOptional() @Version() driverIosMinVersion?: string;
  @ApiPropertyOptional() @Version() driverIosLatestVersion?: string;
  @ApiPropertyOptional() @Version() driverAndroidMinVersion?: string;
  @ApiPropertyOptional() @Version() driverAndroidLatestVersion?: string;
  @ApiPropertyOptional({ nullable: true }) @StoreUrl() driverIosUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) @StoreUrl() driverAndroidUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) @Message() driverForceMessage?: string | null;

  @ApiPropertyOptional() @Version() attendantIosMinVersion?: string;
  @ApiPropertyOptional() @Version() attendantIosLatestVersion?: string;
  @ApiPropertyOptional() @Version() attendantAndroidMinVersion?: string;
  @ApiPropertyOptional() @Version() attendantAndroidLatestVersion?: string;
  @ApiPropertyOptional({ nullable: true }) @StoreUrl() attendantIosUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) @StoreUrl() attendantAndroidUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) @Message() attendantForceMessage?: string | null;

  @ApiPropertyOptional() @Version() parentIosMinVersion?: string;
  @ApiPropertyOptional() @Version() parentIosLatestVersion?: string;
  @ApiPropertyOptional() @Version() parentAndroidMinVersion?: string;
  @ApiPropertyOptional() @Version() parentAndroidLatestVersion?: string;
  @ApiPropertyOptional({ nullable: true }) @StoreUrl() parentIosUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) @StoreUrl() parentAndroidUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) @Message() parentForceMessage?: string | null;

  @ApiPropertyOptional() @Version() universityIosMinVersion?: string;
  @ApiPropertyOptional() @Version() universityIosLatestVersion?: string;
  @ApiPropertyOptional() @Version() universityAndroidMinVersion?: string;
  @ApiPropertyOptional() @Version() universityAndroidLatestVersion?: string;
  @ApiPropertyOptional({ nullable: true }) @StoreUrl() universityIosUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) @StoreUrl() universityAndroidUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) @Message() universityForceMessage?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @StoreUrl()
  supportWhatsappUrl?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() maintenanceApps?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() maintenanceDashboard?: boolean;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(500) maintenanceMessageAr?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(500) maintenanceMessageEn?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() announcementEnabled?: boolean;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(120) announcementTitleAr?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(1000) announcementBodyAr?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(120) announcementTitleEn?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(1000) announcementBodyEn?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() fcmParents?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() fcmUniversity?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() fcmDrivers?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() fcmAttendants?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() fcmAdmins?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) templateDelayTitleAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) templateDelayBodyAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) templateDelayTitleEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) templateDelayBodyEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) templateEmergencyTitleAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) templateEmergencyBodyAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) templateEmergencyTitleEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) templateEmergencyBodyEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) templateArrivalTitleAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) templateArrivalBodyAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) templateArrivalTitleEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) templateArrivalBodyEn?: string;
}
