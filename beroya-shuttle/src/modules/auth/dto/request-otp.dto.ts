import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

// OTP parked — restore with /auth/otp/request.
export class RequestOtpDto {
  @ApiProperty({ example: '+963900000000' })
  @IsString()
  @MinLength(8)
  @Matches(/^\+?[0-9][0-9\s-]{6,}[0-9]$/, {
    message: 'phone must be a valid phone number',
  })
  phone!: string;
}
