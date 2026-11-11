import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { DeviceDto } from './dto/device.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginDto } from './dto/login.dto';
// OTP parked — restore these imports with the /auth/otp routes below.
// import { RequestOtpDto } from './dto/request-otp.dto';
// import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() body: LoginDto, @Req() request: Request) {
    return this.authService.login(body.email, body.password, {
      ip: this.clientIp(request),
      userAgent: request.headers['user-agent'],
    });
  }

  // OTP parked — restore with SmsModule + AuthService.requestOtp/verifyOtp.
  // @Public()
  // @Throttle({ default: { limit: 10, ttl: 60_000 } })
  // @Post('otp/request')
  // @ApiOperation({ summary: 'Request an OTP for an existing phone' })
  // requestOtp(@Body() body: RequestOtpDto, @Req() request: Request) {
  //   return this.authService.requestOtp(body.phone, this.clientIp(request));
  // }
  //
  // @Public()
  // @Post('otp/verify')
  // @ApiOperation({ summary: 'Verify OTP and issue tokens' })
  // verifyOtp(@Body() body: VerifyOtpDto, @Req() request: Request) {
  //   return this.authService.verifyOtp(body.phone, body.code, body.device, {
  //     ip: this.clientIp(request),
  //     userAgent: request.headers['user-agent'],
  //   });
  // }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  refresh(@Body() body: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(body.refreshToken, {
      ip: this.clientIp(request),
      userAgent: request.headers['user-agent'],
    });
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@CurrentUser('sessionId') sessionId: string) {
    await this.authService.logout(sessionId);
    return { success: true };
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @ApiOperation({ summary: 'Revoke every session for the current user' })
  async logoutAll(@CurrentUser('sub') userId: string) {
    await this.authService.logoutAll(userId);
    return { success: true };
  }

  @ApiBearerAuth()
  @Delete('account')
  @ApiOperation({
    summary:
      'Self-delete the current mobile account (soft delete + revoke sessions)',
  })
  deleteAccount(@CurrentUser('sub') userId: string) {
    return this.authService.deleteAccount(userId);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser('sub') userId: string) {
    return this.authService.me(userId);
  }

  @ApiBearerAuth()
  @Post('devices')
  @ApiOperation({ summary: 'Register or update an FCM device token' })
  upsertDevice(@CurrentUser('sub') userId: string, @Body() body: DeviceDto) {
    return this.authService.upsertDevice(userId, body);
  }

  @ApiBearerAuth()
  @Delete('devices/:deviceId')
  @ApiOperation({ summary: 'Remove a registered device' })
  async removeDevice(
    @CurrentUser('sub') userId: string,
    @Param('deviceId') deviceId: string,
  ) {
    await this.authService.removeDevice(userId, deviceId);
    return { success: true };
  }

  private clientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }
}
