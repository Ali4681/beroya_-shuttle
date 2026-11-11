import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  mapPlatformSettings,
  PLATFORM_SETTING_ID,
  clientOps,
  type AppRelease,
  type PlatformSettingsView,
} from '../admin/platform-settings';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async read(): Promise<PlatformSettingsView> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { id: PLATFORM_SETTING_ID },
    });
    return mapPlatformSettings(row);
  }

  async gpsStaleAfterSeconds(institutionId?: string | null): Promise<number> {
    const platform = await this.read();
    if (!institutionId) return platform.gpsStaleAfterSeconds;
    const settings = await this.prisma.institutionSettings.findUnique({
      where: { institutionId },
      select: { gpsStaleAfterSeconds: true },
    });
    return settings?.gpsStaleAfterSeconds ?? platform.gpsStaleAfterSeconds;
  }

  trackingFor(app: AppRelease, platform: PlatformSettingsView) {
    return {
      locationPingIntervalSeconds: platform.locationPingIntervalSeconds,
      gpsStaleAfterSeconds: platform.gpsStaleAfterSeconds,
      app,
    };
  }

  clientOps(platform: PlatformSettingsView) {
    return clientOps(platform);
  }
}
