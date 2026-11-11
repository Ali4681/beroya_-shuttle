import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { DeviceDto } from './device.dto';
import { RequestOtpDto } from './request-otp.dto';

// OTP parked — restore with /auth/otp/verify.
export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '000000' })
  @IsString()
  @Length(4, 8)
  code!: string;

  @ApiPropertyOptional({ type: DeviceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceDto)
  device?: DeviceDto;
}
