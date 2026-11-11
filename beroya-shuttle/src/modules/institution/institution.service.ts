import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { assertTimeZone, daysRemaining } from '../../common/utils/timezone';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../admin/admin.constants';
import { mapSubscription, pickCurrentSubscription } from '../admin/admin.mapper';
import { UpdateBrandingDto } from '../admin/dto/update-branding.dto';
import {
  mapBranding,
  mapInstitutionProfile,
  mapSettings,
  mapUser,
  mapInstitution,
  mapBranch,
} from '../auth/auth.mapper';
import { AuditService } from '../shared/audit/audit.service';
import { UploadsService } from './uploads.service';
import { UpdateInstitutionProfileDto } from './dto/update-profile.dto';
import { UpdateInstitutionSettingsDto } from './dto/update-institution-settings.dto';

@Injectable()
export class InstitutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uploads: UploadsService,
  ) {}

  async bootstrap(userId: string, institutionId: string) {
    const user = await this.prisma.shuttleUser.findFirst({
      where: { id: userId, institutionId, archivedAt: null },
    });
    if (!user) {
      throw new AppException(
        'USER_NOT_FOUND',
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const institution = await this.loadInstitution(institutionId);
    return {
      user: mapUser(user),
      institution: mapInstitution(institution),
      branding: mapBranding(institution.branding),
      settings: mapSettings(institution.settings),
      branches: institution.branches.map(mapBranch),
    };
  }

  async getProfile(institutionId: string) {
    const institution = await this.loadInstitution(institutionId);
    return mapInstitutionProfile(institution);
  }

  async updateProfile(
    actorUserId: string,
    institutionId: string,
    dto: UpdateInstitutionProfileDto,
  ) {
    const current = await this.loadInstitution(institutionId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institution.update({
        where: { id: institutionId },
        data: {
          name: dto.name,
          displayName: dto.displayName,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          address: dto.address,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.INSTITUTION_UPDATED,
          entityType: ENTITY.INSTITUTION,
          entityId: institutionId,
          before: mapInstitutionProfile(current),
          after: mapInstitutionProfile(next),
        },
        tx,
      );
      return next;
    });
    return mapInstitutionProfile(updated);
  }

  async getBranding(institutionId: string) {
    const institution = await this.loadInstitution(institutionId);
    return mapBranding(institution.branding);
  }

  async updateBranding(
    actorUserId: string,
    institutionId: string,
    dto: UpdateBrandingDto,
  ) {
    await this.loadInstitution(institutionId);
    if (dto.logoUrl) {
      await this.uploads.assertLogoUrl(institutionId, dto.logoUrl);
    }
    const current = await this.prisma.institutionBranding.findUnique({
      where: { institutionId },
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institutionBranding.upsert({
        where: { institutionId },
        create: {
          institutionId,
          useInstitutionIdentity: dto.useInstitutionIdentity ?? false,
          logoUrl: dto.logoUrl,
          primaryColor: dto.primaryColor,
          secondaryColor: dto.secondaryColor,
          welcomeMessage: dto.welcomeMessage,
          supportPhone: dto.supportPhone,
        },
        update: {
          useInstitutionIdentity: dto.useInstitutionIdentity,
          logoUrl: dto.logoUrl,
          primaryColor: dto.primaryColor,
          secondaryColor: dto.secondaryColor,
          welcomeMessage: dto.welcomeMessage,
          supportPhone: dto.supportPhone,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.INSTITUTION_BRANDING_UPDATED,
          entityType: ENTITY.INSTITUTION_BRANDING,
          entityId: next.id,
          before: mapBranding(current),
          after: mapBranding(next),
        },
        tx,
      );
      return next;
    });
    return mapBranding(updated);
  }

  async getSettings(institutionId: string) {
    const institution = await this.loadInstitution(institutionId);
    return mapSettings(institution.settings);
  }

  async updateSettings(
    actorUserId: string,
    institutionId: string,
    dto: UpdateInstitutionSettingsDto,
  ) {
    if (dto.timezone) {
      assertTimeZone(dto.timezone);
    }
    // Timezone is a settings change only — already generated ShuttleTrip
    // snapshots (serviceDate, origin, planned arrivals) are never rewritten.
    await this.loadInstitution(institutionId);
    const current = await this.prisma.institutionSettings.findUnique({
      where: { institutionId },
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institutionSettings.upsert({
        where: { institutionId },
        create: {
          institutionId,
          timezone: dto.timezone ?? 'Asia/Damascus',
          defaultDelayThresholdMinutes: dto.defaultDelayThresholdMinutes,
          defaultParentArrivalAlertMinutes:
            dto.defaultParentArrivalAlertMinutes,
          gpsStaleAfterSeconds: dto.gpsStaleAfterSeconds,
          locationPingIntervalSeconds: dto.locationPingIntervalSeconds,
        },
        update: {
          timezone: dto.timezone,
          defaultDelayThresholdMinutes: dto.defaultDelayThresholdMinutes,
          defaultParentArrivalAlertMinutes:
            dto.defaultParentArrivalAlertMinutes,
          gpsStaleAfterSeconds: dto.gpsStaleAfterSeconds,
          locationPingIntervalSeconds: dto.locationPingIntervalSeconds,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.INSTITUTION_SETTINGS_UPDATED,
          entityType: ENTITY.INSTITUTION_SETTINGS,
          entityId: next.id,
          before: mapSettings(current),
          after: mapSettings(next),
        },
        tx,
      );
      return next;
    });
    return mapSettings(updated);
  }

  async getSubscription(institutionId: string) {
    await this.loadInstitution(institutionId);
    const subscriptions = await this.prisma.institutionSubscription.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
    });
    const current =
      pickCurrentSubscription(subscriptions) ?? subscriptions[0] ?? null;
    if (!current) {
      return null;
    }
    return {
      ...mapSubscription(current),
      daysRemaining: daysRemaining(current.endsAt),
    };
  }

  async loadInstitution(institutionId: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { id: institutionId, archivedAt: null },
      include: {
        branding: true,
        settings: true,
        branches: {
          where: { archivedAt: null },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!institution) {
      throw new AppException(
        'INSTITUTION_NOT_FOUND',
        'Institution not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return institution;
  }
}
