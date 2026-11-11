import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { normalizePhone } from '../../common/utils/phone';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { mapUser } from '../auth/auth.mapper';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import {
  emptyToNull,
  mapPlatformSettings,
  PLATFORM_DEFAULTS,
  PLATFORM_SETTING_ID,
} from './platform-settings';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(userId: string) {
    const user = await this.prisma.shuttleUser.findUnique({
      where: { id: userId },
    });
    if (!user || user.archivedAt) {
      throw new AppException(
        'USER_NOT_FOUND',
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      user: mapUser(user),
    };
  }

  async getPlatformSettings() {
    const row = await this.prisma.platformSetting.findUnique({
      where: { id: PLATFORM_SETTING_ID },
    });
    return mapPlatformSettings(row);
  }

  async getSupportContact() {
    const settings = await this.getPlatformSettings();
    return {
      supportPhone: settings.supportPhone,
      supportWhatsappUrl: settings.supportWhatsappUrl,
    };
  }

  async updateSupportContact(supportPhone: string | null | undefined) {
    const settings = await this.updatePlatformSettings({ supportPhone });
    return { supportPhone: settings.supportPhone };
  }

  async updatePlatformSettings(dto: UpdatePlatformSettingsDto) {
    const phone =
      dto.supportPhone === undefined
        ? undefined
        : dto.supportPhone
          ? normalizePhone(dto.supportPhone)
          : null;

    const nullable = [
      'driverIosUrl',
      'driverAndroidUrl',
      'driverForceMessage',
      'attendantIosUrl',
      'attendantAndroidUrl',
      'attendantForceMessage',
      'parentIosUrl',
      'parentAndroidUrl',
      'parentForceMessage',
      'universityIosUrl',
      'universityAndroidUrl',
      'universityForceMessage',
      'supportWhatsappUrl',
      'maintenanceMessageAr',
      'maintenanceMessageEn',
      'announcementTitleAr',
      'announcementBodyAr',
      'announcementTitleEn',
      'announcementBodyEn',
    ] as const;
    const scalars = [
      'gpsStaleAfterSeconds',
      'locationPingIntervalSeconds',
      'maintenanceApps',
      'maintenanceDashboard',
      'announcementEnabled',
      'fcmParents',
      'fcmUniversity',
      'fcmDrivers',
      'fcmAttendants',
      'fcmAdmins',
      'templateDelayTitleAr',
      'templateDelayBodyAr',
      'templateDelayTitleEn',
      'templateDelayBodyEn',
      'templateEmergencyTitleAr',
      'templateEmergencyBodyAr',
      'templateEmergencyTitleEn',
      'templateEmergencyBodyEn',
      'templateArrivalTitleAr',
      'templateArrivalBodyAr',
      'templateArrivalTitleEn',
      'templateArrivalBodyEn',
      'driverIosMinVersion',
      'driverIosLatestVersion',
      'driverAndroidMinVersion',
      'driverAndroidLatestVersion',
      'attendantIosMinVersion',
      'attendantIosLatestVersion',
      'attendantAndroidMinVersion',
      'attendantAndroidLatestVersion',
      'parentIosMinVersion',
      'parentIosLatestVersion',
      'parentAndroidMinVersion',
      'parentAndroidLatestVersion',
      'universityIosMinVersion',
      'universityIosLatestVersion',
      'universityAndroidMinVersion',
      'universityAndroidLatestVersion',
    ] as const;

    const data: Prisma.PlatformSettingUncheckedUpdateInput = {
      ...(phone !== undefined ? { supportPhone: phone } : {}),
    };
    for (const key of scalars) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    for (const key of nullable) {
      if (dto[key] !== undefined) data[key] = emptyToNull(dto[key]);
    }

    const row = await this.prisma.platformSetting.upsert({
      where: { id: PLATFORM_SETTING_ID },
      create: {
        id: PLATFORM_SETTING_ID,
        gpsStaleAfterSeconds:
          data.gpsStaleAfterSeconds ?? PLATFORM_DEFAULTS.gpsStaleAfterSeconds,
        locationPingIntervalSeconds:
          data.locationPingIntervalSeconds ??
          PLATFORM_DEFAULTS.locationPingIntervalSeconds,
        supportPhone: data.supportPhone ?? undefined,
        driverIosMinVersion: data.driverIosMinVersion,
        driverIosLatestVersion: data.driverIosLatestVersion,
        driverAndroidMinVersion: data.driverAndroidMinVersion,
        driverAndroidLatestVersion: data.driverAndroidLatestVersion,
        driverIosUrl: data.driverIosUrl,
        driverAndroidUrl: data.driverAndroidUrl,
        driverForceMessage: data.driverForceMessage,
        attendantIosMinVersion: data.attendantIosMinVersion,
        attendantIosLatestVersion: data.attendantIosLatestVersion,
        attendantAndroidMinVersion: data.attendantAndroidMinVersion,
        attendantAndroidLatestVersion: data.attendantAndroidLatestVersion,
        attendantIosUrl: data.attendantIosUrl,
        attendantAndroidUrl: data.attendantAndroidUrl,
        attendantForceMessage: data.attendantForceMessage,
        parentIosMinVersion: data.parentIosMinVersion,
        parentIosLatestVersion: data.parentIosLatestVersion,
        parentAndroidMinVersion: data.parentAndroidMinVersion,
        parentAndroidLatestVersion: data.parentAndroidLatestVersion,
        parentIosUrl: data.parentIosUrl,
        parentAndroidUrl: data.parentAndroidUrl,
        parentForceMessage: data.parentForceMessage,
        universityIosMinVersion: data.universityIosMinVersion,
        universityIosLatestVersion: data.universityIosLatestVersion,
        universityAndroidMinVersion: data.universityAndroidMinVersion,
        universityAndroidLatestVersion: data.universityAndroidLatestVersion,
        universityIosUrl: data.universityIosUrl,
        universityAndroidUrl: data.universityAndroidUrl,
        universityForceMessage: data.universityForceMessage,
        supportWhatsappUrl: data.supportWhatsappUrl,
        maintenanceApps: data.maintenanceApps,
        maintenanceDashboard: data.maintenanceDashboard,
        maintenanceMessageAr: data.maintenanceMessageAr,
        maintenanceMessageEn: data.maintenanceMessageEn,
        announcementEnabled: data.announcementEnabled,
        announcementTitleAr: data.announcementTitleAr,
        announcementBodyAr: data.announcementBodyAr,
        announcementTitleEn: data.announcementTitleEn,
        announcementBodyEn: data.announcementBodyEn,
        fcmParents: data.fcmParents,
        fcmUniversity: data.fcmUniversity,
        fcmDrivers: data.fcmDrivers,
        fcmAttendants: data.fcmAttendants,
        fcmAdmins: data.fcmAdmins,
        templateDelayTitleAr: data.templateDelayTitleAr,
        templateDelayBodyAr: data.templateDelayBodyAr,
        templateDelayTitleEn: data.templateDelayTitleEn,
        templateDelayBodyEn: data.templateDelayBodyEn,
        templateEmergencyTitleAr: data.templateEmergencyTitleAr,
        templateEmergencyBodyAr: data.templateEmergencyBodyAr,
        templateEmergencyTitleEn: data.templateEmergencyTitleEn,
        templateEmergencyBodyEn: data.templateEmergencyBodyEn,
        templateArrivalTitleAr: data.templateArrivalTitleAr,
        templateArrivalBodyAr: data.templateArrivalBodyAr,
        templateArrivalTitleEn: data.templateArrivalTitleEn,
        templateArrivalBodyEn: data.templateArrivalBodyEn,
      } as Prisma.PlatformSettingUncheckedCreateInput,
      update: data,
    });
    return mapPlatformSettings(row);
  }
}
