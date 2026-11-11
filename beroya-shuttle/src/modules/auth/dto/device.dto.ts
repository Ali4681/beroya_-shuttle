import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { DevicePlatform } from '../../../generated/prisma/client';

export class DeviceDto {
  @ApiProperty({ example: 'pixel-8-omar' })
  @IsString()
  @MinLength(3)
  deviceId!: string;

  @ApiProperty({ example: 'fcm-token-example' })
  @IsString()
  @MinLength(8)
  fcmToken!: string;

  @ApiProperty({ enum: DevicePlatform, example: DevicePlatform.ANDROID })
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiPropertyOptional({ enum: ['ar', 'en'], example: 'ar' })
  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: 'ar' | 'en';
}
