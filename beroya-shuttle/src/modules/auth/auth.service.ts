import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { AppException } from '../../common/errors/app.exception';
import { parseAppLocale } from '../../common/i18n';
import { getRequestContext } from '../../common/request-context/request-context';
import { AuthUser } from '../../common/types/auth-user';
import { Env } from '../../config/env.schema';
import {
  ResourceStatus,
  ShuttleRole,
  ShuttleUser,
  StudentStatus,
  UserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { normalizeEmail, verifyPassword } from '../../common/utils/password';
import { parseTtlToSeconds } from './auth.constants';
// OTP parked — restore with requestOtp/verifyOtp.
// import { Inject } from '@nestjs/common';
// import { randomInt } from 'node:crypto';
// import { RedisService } from '../../infra/redis/redis.service';
// import type { SmsProvider } from '../../infra/sms/sms.provider';
// import { SMS_PROVIDER } from '../../infra/sms/sms.provider';
// import { normalizePhone } from '../../common/utils/phone';
// import {
//   OTP_HOUR_WINDOW_SECONDS,
//   OTP_IP_HOURLY_LIMIT,
//   OTP_MAX_ATTEMPTS,
//   OTP_PHONE_HOURLY_LIMIT,
//   OTP_THROTTLE_SECONDS,
//   otpIpHourKey,
//   otpKey,
//   otpPhoneHourKey,
//   otpThrottleKey,
// } from './auth.constants';
import {
  assertUserCanLogin,
  isRefreshReuse,
  type LoginUser,
} from './auth.rules';
import { mapStudent, mapUser } from './auth.mapper';
import { DeviceDto } from './dto/device.dto';

// OTP parked — restore type with requestOtp/verifyOtp.
// type OtpRecord = {
//   code: string;
//   attempts: number;
//   userId: string;
// };

type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
    // OTP parked — restore with SmsModule.
    // private readonly redis: RedisService,
    // @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async login(email: string, password: string, meta: { ip?: string; userAgent?: string }) {
    const normalized = normalizeEmail(email);
    const user = await this.prisma.shuttleUser.findFirst({
      where: { email: normalized, archivedAt: null },
      include: { institution: true },
    });
    const passwordOk =
      user?.passwordHash != null && (await verifyPassword(password, user.passwordHash));
    if (!user || !passwordOk) {
      throw new AppException(
        'INVALID_CREDENTIALS',
        'Email or password is incorrect',
        HttpStatus.UNAUTHORIZED,
      );
    }
    this.assertUserCanLogin(user);
    return this.completeLogin(user, undefined, meta);
  }

  // OTP parked — restore with SmsModule + /auth/otp routes.
  // async requestOtp(phone: string, ip: string): Promise<{ expiresIn: number }> {
  //   const normalized = normalizePhone(phone);
  //   const user = await this.findLoginUser(normalized);
  //   this.assertUserCanLogin(user);
  //
  //   await this.enforceOtpLimits(normalized, ip);
  //
  //   const ttl = this.config.get('OTP_TTL_SECONDS', { infer: true });
  //   const code = this.createOtpCode();
  //   const record: OtpRecord = { code, attempts: 0, userId: user.id };
  //   await this.redis.set(otpKey(normalized), JSON.stringify(record), ttl);
  //   await this.sms.sendOtp(normalized, code);
  //
  //   return { expiresIn: ttl };
  // }
  //
  // async verifyOtp(
  //   phone: string,
  //   code: string,
  //   device: DeviceDto | undefined,
  //   meta: { ip?: string; userAgent?: string },
  // ) {
  //   const normalized = normalizePhone(phone);
  //   const raw = await this.redis.get(otpKey(normalized));
  //   const devCode = this.config.get('OTP_DEV_CODE', { infer: true });
  //   const isDev = this.config.get('NODE_ENV', { infer: true }) !== 'production';
  //
  //   if (!raw) {
  //     if (isDev && devCode && code.trim() === devCode) {
  //       const user = await this.findLoginUser(normalized);
  //       this.assertUserCanLogin(user);
  //       return this.completeLogin(user, device, meta);
  //     }
  //     throw new AppException(
  //       'OTP_EXPIRED',
  //       'OTP has expired. Request a new code',
  //       HttpStatus.UNAUTHORIZED,
  //     );
  //   }
  //
  //   const record = JSON.parse(raw) as OtpRecord;
  //   if (record.code !== code.trim()) {
  //     record.attempts += 1;
  //     if (record.attempts >= OTP_MAX_ATTEMPTS) {
  //       await this.redis.del(otpKey(normalized));
  //       throw new AppException(
  //         'OTP_MAX_ATTEMPTS',
  //         'Too many invalid OTP attempts',
  //         HttpStatus.UNAUTHORIZED,
  //       );
  //     }
  //     const ttl = this.config.get('OTP_TTL_SECONDS', { infer: true });
  //     await this.redis.set(otpKey(normalized), JSON.stringify(record), ttl);
  //     throw new AppException(
  //       'OTP_INVALID',
  //       'Invalid OTP code',
  //       HttpStatus.UNAUTHORIZED,
  //       { attemptsLeft: OTP_MAX_ATTEMPTS - record.attempts },
  //     );
  //   }
  //
  //   await this.redis.del(otpKey(normalized));
  //
  //   const user = await this.prisma.shuttleUser.findUnique({
  //     where: { id: record.userId },
  //     include: { institution: true },
  //   });
  //   if (!user || user.archivedAt) {
  //     throw new AppException(
  //       'USER_NOT_FOUND',
  //       'No account exists for this phone',
  //       HttpStatus.NOT_FOUND,
  //     );
  //   }
  //   this.assertUserCanLogin(user);
  //   return this.completeLogin(user, device, meta);
  // }

  private async completeLogin(
    user: ShuttleUser & { institution?: { status: string } | null },
    device: DeviceDto | undefined,
    meta: { ip?: string; userAgent?: string },
  ) {
    if (device) {
      await this.upsertDevice(user.id, device);
    }

    const tokens = await this.issueTokens(user, {
      deviceId: device?.deviceId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const updated = await this.prisma.shuttleUser.update({
      where: { id: user.id },
      data: {
        phoneVerifiedAt: user.phoneVerifiedAt ?? new Date(),
        lastLoginAt: new Date(),
      },
    });

    return {
      ...tokens,
      user: mapUser(updated),
    };
  }

  async refresh(
    refreshToken: string,
    meta: { ip?: string; userAgent?: string },
  ) {
    const hash = this.hashToken(refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: { include: { institution: true } } },
    });

    if (!session) {
      throw new AppException(
        'REFRESH_INVALID',
        'Refresh token is invalid',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (isRefreshReuse(session)) {
      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppException(
        'REFRESH_TOKEN_REUSED',
        'Refresh token reuse detected. All sessions were revoked',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (session.expiresAt <= new Date()) {
      throw new AppException(
        'REFRESH_EXPIRED',
        'Refresh token has expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.assertUserCanLogin(session.user);

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(session.user, {
      deviceId: session.deviceId ?? undefined,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      ...tokens,
      user: mapUser(session.user),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Soft-deletes a mobile end-user account (parent / university / driver / attendant).
   * Revokes sessions, removes devices, anonymizes unique identifiers, and archives
   * role profiles. Historical trip/ops data is retained.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.shuttleUser.findFirst({
      where: { id: userId, archivedAt: null },
    });
    if (!user) {
      throw new AppException(
        'USER_NOT_FOUND',
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const deletableRoles: ShuttleRole[] = [
      ShuttleRole.PARENT,
      ShuttleRole.UNIVERSITY_STUDENT,
      ShuttleRole.DRIVER,
      ShuttleRole.ATTENDANT,
    ];
    if (!deletableRoles.includes(user.role)) {
      throw new AppException(
        'ACCOUNT_DELETE_NOT_ALLOWED',
        'This account type cannot be self-deleted',
        HttpStatus.FORBIDDEN,
      );
    }

    const now = new Date();
    const idCompact = userId.replace(/-/g, '');
    const tombstonePhone = `+000${idCompact.slice(0, 12)}`;
    const tombstoneEmail = `deleted.${idCompact}@deleted.invalid`;

    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.userDevice.deleteMany({ where: { userId } });

      if (user.role === ShuttleRole.PARENT) {
        await tx.schoolStudent.updateMany({
          where: { guardianUserId: userId, archivedAt: null },
          data: { status: StudentStatus.INACTIVE },
        });
      }

      if (user.role === ShuttleRole.UNIVERSITY_STUDENT) {
        await tx.universityStudentProfile.updateMany({
          where: { userId, archivedAt: null },
          data: { status: StudentStatus.INACTIVE, archivedAt: now },
        });
      }

      if (user.role === ShuttleRole.DRIVER) {
        await tx.driverProfile.updateMany({
          where: { userId, archivedAt: null },
          data: { status: ResourceStatus.SUSPENDED, archivedAt: now },
        });
      }

      if (user.role === ShuttleRole.ATTENDANT) {
        await tx.attendantProfile.updateMany({
          where: { userId, archivedAt: null },
          data: { status: ResourceStatus.SUSPENDED, archivedAt: now },
        });
      }

      await tx.shuttleUser.update({
        where: { id: userId },
        data: {
          status: UserStatus.SUSPENDED,
          archivedAt: now,
          passwordHash: null,
          phoneVerifiedAt: null,
          email: tombstoneEmail,
          phone: tombstonePhone,
          fullName: 'Deleted User',
        },
      });
    });

    return { success: true, deletedAt: now.toISOString() };
  }

  async me(userId: string) {
    const user = await this.prisma.shuttleUser.findUnique({
      where: { id: userId },
      include: {
        guardedStudents: {
          where: { archivedAt: null },
          orderBy: { fullName: 'asc' },
        },
      },
    });
    if (!user || user.archivedAt) {
      throw new AppException(
        'USER_NOT_FOUND',
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      ...mapUser(user),
      students:
        user.role === ShuttleRole.PARENT
          ? user.guardedStudents.map(mapStudent)
          : undefined,
    };
  }

  async upsertDevice(userId: string, device: DeviceDto) {
    const locale = parseAppLocale(device.locale, getRequestContext()?.locale);
    return this.prisma.userDevice.upsert({
      where: {
        userId_deviceId: { userId, deviceId: device.deviceId },
      },
      create: {
        userId,
        deviceId: device.deviceId,
        fcmToken: device.fcmToken,
        platform: device.platform,
        locale,
        appVersion: device.appVersion,
        lastSeenAt: new Date(),
      },
      update: {
        fcmToken: device.fcmToken,
        platform: device.platform,
        locale,
        appVersion: device.appVersion,
        lastSeenAt: new Date(),
      },
    });
  }

  async removeDevice(userId: string, deviceId: string): Promise<void> {
    const deleted = await this.prisma.userDevice.deleteMany({
      where: { userId, deviceId },
    });
    if (deleted.count === 0) {
      throw new AppException(
        'DEVICE_NOT_FOUND',
        'Device not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async issueTokens(
    user: ShuttleUser,
    meta: { deviceId?: string; ip?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshDays = this.config.get('JWT_REFRESH_TTL_DAYS', {
      infer: true,
    });
    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        deviceId: meta.deviceId,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
      },
    });

    const payload: AuthUser = {
      sub: user.id,
      role: user.role,
      institutionId: user.institutionId,
      branchId: user.branchId,
      sessionId: session.id,
    };

    const accessTtl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: parseTtlToSeconds(accessTtl),
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: parseTtlToSeconds(accessTtl),
    };
  }

  // OTP parked — restore with requestOtp/verifyOtp.
  // private async findLoginUser(phone: string) {
  //   const users = await this.prisma.shuttleUser.findMany({
  //     where: { phone, archivedAt: null },
  //     include: { institution: true },
  //   });
  //
  //   if (users.length === 0) {
  //     throw new AppException(
  //       'USER_NOT_FOUND',
  //       'No account exists for this phone',
  //       HttpStatus.NOT_FOUND,
  //     );
  //   }
  //
  //   const candidates = users.filter(
  //     (user) =>
  //       user.status === UserStatus.ACTIVE &&
  //       (!user.institution ||
  //         user.institution.status === InstitutionStatus.ACTIVE),
  //   );
  //
  //   if (users.length > 1 && candidates.length !== 1) {
  //     throw new AppException(
  //       'ACCOUNT_AMBIGUOUS',
  //       'This phone is linked to more than one account',
  //       HttpStatus.CONFLICT,
  //     );
  //   }
  //
  //   return candidates[0] ?? users[0];
  // }

  private assertUserCanLogin(user: LoginUser): void {
    assertUserCanLogin(user);
  }

  // OTP parked — restore with requestOtp.
  // private async enforceOtpLimits(phone: string, ip: string): Promise<void> {
  //   const reserved = await this.redis.setNx(
  //     otpThrottleKey(phone),
  //     '1',
  //     OTP_THROTTLE_SECONDS,
  //   );
  //   if (!reserved) {
  //     throw new AppException(
  //       'OTP_THROTTLED',
  //       'Please wait before requesting another OTP',
  //       HttpStatus.TOO_MANY_REQUESTS,
  //     );
  //   }
  //
  //   const phoneCount = await this.incrementWithWindow(
  //     otpPhoneHourKey(phone),
  //     OTP_HOUR_WINDOW_SECONDS,
  //   );
  //   if (phoneCount > OTP_PHONE_HOURLY_LIMIT) {
  //     throw new AppException(
  //       'OTP_RATE_LIMITED',
  //       'Too many OTP requests for this phone',
  //       HttpStatus.TOO_MANY_REQUESTS,
  //     );
  //   }
  //
  //   const ipCount = await this.incrementWithWindow(
  //     otpIpHourKey(ip),
  //     OTP_HOUR_WINDOW_SECONDS,
  //   );
  //   if (ipCount > OTP_IP_HOURLY_LIMIT) {
  //     throw new AppException(
  //       'OTP_RATE_LIMITED',
  //       'Too many OTP requests from this IP',
  //       HttpStatus.TOO_MANY_REQUESTS,
  //     );
  //   }
  // }
  //
  // private async incrementWithWindow(
  //   key: string,
  //   windowSeconds: number,
  // ): Promise<number> {
  //   const count = await this.redis.incr(key);
  //   if (count === 1) {
  //     await this.redis.expire(key, windowSeconds);
  //   }
  //   return count;
  // }
  //
  // private createOtpCode(): string {
  //   const nodeEnv = this.config.get('NODE_ENV', { infer: true });
  //   const devCode = this.config.get('OTP_DEV_CODE', { infer: true });
  //   if (nodeEnv !== 'production' && devCode) {
  //     return devCode;
  //   }
  //   return String(randomInt(0, 1_000_000)).padStart(6, '0');
  // }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
