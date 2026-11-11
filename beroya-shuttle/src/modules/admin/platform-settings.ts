import type { AppLocale } from '../../common/i18n';
import { parseAppLocale } from '../../common/i18n';
import { NotificationAudience, PlatformSetting } from '../../generated/prisma/client';

export const PLATFORM_SETTING_ID = 'default';

export type StoreRelease = {
  minVersion: string;
  latestVersion: string;
  storeUrl: string | null;
};

export type AppRelease = {
  ios: StoreRelease;
  android: StoreRelease;
  forceMessage: string | null;
};

export type LocalizedCopy = {
  titleAr: string;
  bodyAr: string;
  titleEn: string;
  bodyEn: string;
};

export type NoticeTemplate = LocalizedCopy;

export type PlatformSettingsView = {
  supportPhone: string | null;
  supportWhatsappUrl: string | null;
  gpsStaleAfterSeconds: number;
  locationPingIntervalSeconds: number;
  maintenance: {
    apps: boolean;
    dashboard: boolean;
    messageAr: string | null;
    messageEn: string | null;
  };
  announcement: {
    enabled: boolean;
  } & LocalizedCopy;
  fcm: {
    parents: boolean;
    university: boolean;
    drivers: boolean;
    attendants: boolean;
    admins: boolean;
  };
  templates: {
    delay: NoticeTemplate;
    emergency: NoticeTemplate;
    arrivalSoon: NoticeTemplate;
  };
  apps: {
    driver: AppRelease;
    attendant: AppRelease;
    parent: AppRelease;
    university: AppRelease;
  };
  updatedAt: Date;
};

export const PLATFORM_DEFAULTS = {
  gpsStaleAfterSeconds: 120,
  locationPingIntervalSeconds: 15,
  version: '1.0.0',
  templates: {
    delay: {
      titleAr: 'الرحلة متأخرة',
      bodyAr: 'هذه الرحلة متأخرة حوالي {minutes} دقيقة عن الجدول.',
      titleEn: 'Trip delayed',
      bodyEn: 'This trip is about {minutes} minutes behind schedule.',
    },
    emergency: {
      titleAr: 'طوارئ في رحلة',
      bodyAr: 'تم الضغط على زر الطوارئ.',
      titleEn: 'Emergency on a trip',
      bodyEn: 'An emergency button was pressed.',
    },
    arrivalSoon: {
      titleAr: 'الحافلة تقترب',
      bodyAr: 'حافلة {studentName} على بعد حوالي {minutes} دقيقة.',
      titleEn: 'Bus is approaching',
      bodyEn: "{studentName}'s bus is about {minutes} minutes away.",
    },
  },
} as const;

function store(
  minVersion?: string,
  latestVersion?: string,
  storeUrl?: string | null,
): StoreRelease {
  return {
    minVersion: minVersion ?? PLATFORM_DEFAULTS.version,
    latestVersion: latestVersion ?? PLATFORM_DEFAULTS.version,
    storeUrl: storeUrl ?? null,
  };
}

function copy(
  fallback: NoticeTemplate,
  titleAr?: string | null,
  bodyAr?: string | null,
  titleEn?: string | null,
  bodyEn?: string | null,
): LocalizedCopy {
  return {
    titleAr: titleAr?.trim() || fallback.titleAr,
    bodyAr: bodyAr?.trim() || fallback.bodyAr,
    titleEn: titleEn?.trim() || fallback.titleEn,
    bodyEn: bodyEn?.trim() || fallback.bodyEn,
  };
}

export function mapPlatformSettings(
  row: PlatformSetting | null,
): PlatformSettingsView {
  return {
    supportPhone: row?.supportPhone ?? null,
    supportWhatsappUrl: row?.supportWhatsappUrl ?? null,
    gpsStaleAfterSeconds:
      row?.gpsStaleAfterSeconds ?? PLATFORM_DEFAULTS.gpsStaleAfterSeconds,
    locationPingIntervalSeconds:
      row?.locationPingIntervalSeconds ??
      PLATFORM_DEFAULTS.locationPingIntervalSeconds,
    maintenance: {
      apps: row?.maintenanceApps ?? false,
      dashboard: row?.maintenanceDashboard ?? false,
      messageAr: row?.maintenanceMessageAr ?? null,
      messageEn: row?.maintenanceMessageEn ?? null,
    },
    announcement: {
      enabled: row?.announcementEnabled ?? false,
      ...copy(
        { titleAr: '', bodyAr: '', titleEn: '', bodyEn: '' },
        row?.announcementTitleAr,
        row?.announcementBodyAr,
        row?.announcementTitleEn,
        row?.announcementBodyEn,
      ),
    },
    fcm: {
      parents: row?.fcmParents ?? true,
      university: row?.fcmUniversity ?? true,
      drivers: row?.fcmDrivers ?? true,
      attendants: row?.fcmAttendants ?? true,
      admins: row?.fcmAdmins ?? true,
    },
    templates: {
      delay: copy(
        PLATFORM_DEFAULTS.templates.delay,
        row?.templateDelayTitleAr,
        row?.templateDelayBodyAr,
        row?.templateDelayTitleEn,
        row?.templateDelayBodyEn,
      ),
      emergency: copy(
        PLATFORM_DEFAULTS.templates.emergency,
        row?.templateEmergencyTitleAr,
        row?.templateEmergencyBodyAr,
        row?.templateEmergencyTitleEn,
        row?.templateEmergencyBodyEn,
      ),
      arrivalSoon: copy(
        PLATFORM_DEFAULTS.templates.arrivalSoon,
        row?.templateArrivalTitleAr,
        row?.templateArrivalBodyAr,
        row?.templateArrivalTitleEn,
        row?.templateArrivalBodyEn,
      ),
    },
    apps: {
      driver: {
        ios: store(row?.driverIosMinVersion, row?.driverIosLatestVersion, row?.driverIosUrl),
        android: store(
          row?.driverAndroidMinVersion,
          row?.driverAndroidLatestVersion,
          row?.driverAndroidUrl,
        ),
        forceMessage: row?.driverForceMessage ?? null,
      },
      attendant: {
        ios: store(
          row?.attendantIosMinVersion,
          row?.attendantIosLatestVersion,
          row?.attendantIosUrl,
        ),
        android: store(
          row?.attendantAndroidMinVersion,
          row?.attendantAndroidLatestVersion,
          row?.attendantAndroidUrl,
        ),
        forceMessage: row?.attendantForceMessage ?? null,
      },
      parent: {
        ios: store(row?.parentIosMinVersion, row?.parentIosLatestVersion, row?.parentIosUrl),
        android: store(
          row?.parentAndroidMinVersion,
          row?.parentAndroidLatestVersion,
          row?.parentAndroidUrl,
        ),
        forceMessage: row?.parentForceMessage ?? null,
      },
      university: {
        ios: store(
          row?.universityIosMinVersion,
          row?.universityIosLatestVersion,
          row?.universityIosUrl,
        ),
        android: store(
          row?.universityAndroidMinVersion,
          row?.universityAndroidLatestVersion,
          row?.universityAndroidUrl,
        ),
        forceMessage: row?.universityForceMessage ?? null,
      },
    },
    updatedAt: row?.updatedAt ?? new Date(0),
  };
}

export function emptyToNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function fillTemplate(
  template: string,
  vars: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] == null ? `{${key}}` : String(vars[key]),
  );
}

export type NoticeI18n = {
  titleAr: string;
  bodyAr: string;
  titleEn: string;
  bodyEn: string;
};

export type PackedNotice = {
  title: string;
  body: string;
  i18n: NoticeI18n;
};

export function packNotice(
  copy: LocalizedCopy,
  vars: Record<string, string | number> = {},
): PackedNotice {
  const titleAr = fillTemplate(copy.titleAr, vars).trim();
  const bodyAr = fillTemplate(copy.bodyAr, vars).trim();
  const titleEn = fillTemplate(copy.titleEn, vars).trim();
  const bodyEn = fillTemplate(copy.bodyEn, vars).trim();
  const i18n: NoticeI18n = { titleAr, bodyAr, titleEn, bodyEn };
  const hasAr = titleAr.length >= 1 && bodyAr.length >= 1;
  if (hasAr) return { title: titleAr, body: bodyAr, i18n };
  return {
    title: titleEn || titleAr,
    body: bodyEn || bodyAr,
    i18n,
  };
}

export function withNoticeI18n(
  data: Record<string, unknown> | undefined,
  notice: PackedNotice,
): Record<string, unknown> {
  return {
    ...(data ?? {}),
    i18n: notice.i18n,
  };
}

export function noticeI18nFromData(data: unknown): NoticeI18n | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const i18n = (data as Record<string, unknown>).i18n;
  if (!i18n || typeof i18n !== 'object' || Array.isArray(i18n)) return null;
  const row = i18n as Record<string, unknown>;
  const titleAr = typeof row.titleAr === 'string' ? row.titleAr.trim() : '';
  const bodyAr = typeof row.bodyAr === 'string' ? row.bodyAr.trim() : '';
  const titleEn = typeof row.titleEn === 'string' ? row.titleEn.trim() : '';
  const bodyEn = typeof row.bodyEn === 'string' ? row.bodyEn.trim() : '';
  if (!titleAr && !bodyAr && !titleEn && !bodyEn) return null;
  return { titleAr, bodyAr, titleEn, bodyEn };
}

export function noticeForLocale(
  title: string,
  body: string,
  data: unknown,
  locale: AppLocale | string | null | undefined,
): { title: string; body: string } {
  const lang = parseAppLocale(locale);
  const i18n = noticeI18nFromData(data);
  if (!i18n) return { title, body };
  if (lang === 'en') {
    const enTitle = i18n.titleEn.trim();
    const enBody = i18n.bodyEn.trim();
    if (enTitle.length >= 1 && enBody.length >= 1) {
      return { title: enTitle, body: enBody };
    }
  }
  const arTitle = i18n.titleAr.trim();
  const arBody = i18n.bodyAr.trim();
  if (arTitle.length >= 1 && arBody.length >= 1) {
    return { title: arTitle, body: arBody };
  }
  const enTitle = i18n.titleEn.trim();
  const enBody = i18n.bodyEn.trim();
  if (enTitle.length >= 1 && enBody.length >= 1) {
    return { title: enTitle, body: enBody };
  }
  return { title, body };
}

export function fcmEnabledFor(
  settings: PlatformSettingsView,
  audience: NotificationAudience,
  internalAudience?: string | null,
) {
  if (internalAudience === 'institution_admins') return settings.fcm.admins;
  switch (audience) {
    case NotificationAudience.ALL_PARENTS:
    case NotificationAudience.ROUTE_PARENTS:
      return settings.fcm.parents;
    case NotificationAudience.ALL_UNIVERSITY_STUDENTS:
    case NotificationAudience.ROUTE_UNIVERSITY_STUDENTS:
      return settings.fcm.university;
    case NotificationAudience.ALL_DRIVERS:
    case NotificationAudience.ROUTE_DRIVERS:
      return settings.fcm.drivers;
    case NotificationAudience.ALL_ATTENDANTS:
    case NotificationAudience.ROUTE_ATTENDANTS:
      return settings.fcm.attendants;
    default:
      return true;
  }
}

export function clientOps(platform: PlatformSettingsView) {
  return {
    supportPhone: platform.supportPhone,
    supportWhatsappUrl: platform.supportWhatsappUrl,
    maintenance: platform.maintenance,
    announcement: platform.announcement.enabled
      ? platform.announcement
      : { enabled: false, titleAr: '', bodyAr: '', titleEn: '', bodyEn: '' },
  };
}
