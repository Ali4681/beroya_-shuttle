import { AppBrandingApp, Prisma } from '../../generated/prisma/client';
import {
  APP_ICON_IDS,
  AppBrandingAppKey,
  AppIconId,
  SplashAnimationType,
  isAppIconId,
  SPLASH_ANIMATION_TYPES,
} from '../../infra/storage/app-branding-storage';

export const HEX_DEFAULTS = {
  primaryColor: '#313193',
  secondaryColor: '#25C5D1',
  backgroundColor: '#FFFFFF',
} as const;

export type AppBrandingPayload = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  splashImageUrl: string | null;
  splashAnimationUrl: string | null;
  splashAnimationType: SplashAnimationType;
  splashDuration: number;
  splashAnimationEnabled: boolean;
  loadingAnimationUrl: string | null;
  homeAnimationUrl: string | null;
  successAnimationUrl: string | null;
  errorAnimationUrl: string | null;
  emptyStateAnimationUrl: string | null;
  selectedAndroidIcon: AppIconId;
  selectedIosIcon: AppIconId;
};

export type AppBrandingPublicView = {
  app: AppBrandingAppKey;
  version: number;
  logo: string | null;
  colors: {
    primary: string;
    secondary: string;
    background: string;
  };
  splash: {
    image: string | null;
    animation: string | null;
    animationType: SplashAnimationType;
    duration: number;
    enabled: boolean;
  };
  animations: {
    loading: string | null;
    home: string | null;
    success: string | null;
    error: string | null;
    empty: string | null;
  };
  appIcon: {
    android: AppIconId;
    ios: AppIconId;
  };
  updatedAt: Date;
};

export type BundledAppIcon = {
  id: AppIconId;
  name: string;
  preview: string;
  android: boolean;
  ios: boolean;
};

export const BUNDLED_APP_ICONS: BundledAppIcon[] = APP_ICON_IDS.map((id, index) => ({
  id,
  name: `Icon ${String(index + 1).padStart(2, '0')}`,
  preview: `/app-icons/${id}.svg`,
  android: true,
  ios: true,
}));

export function prismaAppKey(app: AppBrandingAppKey): AppBrandingApp {
  return app === 'crew' ? AppBrandingApp.CREW : AppBrandingApp.PASSENGER;
}

export function publicAppKey(app: AppBrandingApp): AppBrandingAppKey {
  return app === AppBrandingApp.CREW ? 'crew' : 'passenger';
}

function nullableUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function hexColor(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value.trim())) {
    return value.trim().toUpperCase();
  }
  return fallback;
}

function animationType(value: unknown): SplashAnimationType {
  if (
    typeof value === 'string' &&
    (SPLASH_ANIMATION_TYPES as readonly string[]).includes(value)
  ) {
    return value as SplashAnimationType;
  }
  return 'none';
}

function iconId(value: unknown): AppIconId {
  return typeof value === 'string' && isAppIconId(value) ? value : 'icon_01';
}

function durationMs(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 2500;
  return Math.min(15000, Math.max(500, Math.round(n)));
}

export function defaultBrandingPayload(): AppBrandingPayload {
  return {
    logoUrl: null,
    primaryColor: HEX_DEFAULTS.primaryColor,
    secondaryColor: HEX_DEFAULTS.secondaryColor,
    backgroundColor: HEX_DEFAULTS.backgroundColor,
    splashImageUrl: null,
    splashAnimationUrl: null,
    splashAnimationType: 'none',
    splashDuration: 2500,
    splashAnimationEnabled: false,
    loadingAnimationUrl: null,
    homeAnimationUrl: null,
    successAnimationUrl: null,
    errorAnimationUrl: null,
    emptyStateAnimationUrl: null,
    selectedAndroidIcon: 'icon_01',
    selectedIosIcon: 'icon_01',
  };
}

export function normalizeBrandingPayload(raw: unknown): AppBrandingPayload {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const splash =
    src.splash && typeof src.splash === 'object'
      ? (src.splash as Record<string, unknown>)
      : {};
  const animations =
    src.animations && typeof src.animations === 'object'
      ? (src.animations as Record<string, unknown>)
      : {};
  const appIcon =
    src.appIcon && typeof src.appIcon === 'object'
      ? (src.appIcon as Record<string, unknown>)
      : {};
  return {
    logoUrl: nullableUrl(src.logoUrl ?? src.logo),
    primaryColor: hexColor(
      src.primaryColor ??
        (src.colors as Record<string, unknown> | undefined)?.primary,
      HEX_DEFAULTS.primaryColor,
    ),
    secondaryColor: hexColor(
      src.secondaryColor ??
        (src.colors as Record<string, unknown> | undefined)?.secondary,
      HEX_DEFAULTS.secondaryColor,
    ),
    backgroundColor: hexColor(
      src.backgroundColor ??
        (src.colors as Record<string, unknown> | undefined)?.background,
      HEX_DEFAULTS.backgroundColor,
    ),
    splashImageUrl: nullableUrl(src.splashImageUrl ?? splash.image),
    splashAnimationUrl: nullableUrl(src.splashAnimationUrl ?? splash.animation),
    splashAnimationType: animationType(
      src.splashAnimationType ?? splash.animationType,
    ),
    splashDuration: durationMs(src.splashDuration ?? splash.duration),
    splashAnimationEnabled: Boolean(
      src.splashAnimationEnabled ?? splash.enabled ?? false,
    ),
    loadingAnimationUrl: nullableUrl(
      src.loadingAnimationUrl ?? animations.loading,
    ),
    homeAnimationUrl: nullableUrl(src.homeAnimationUrl ?? animations.home),
    successAnimationUrl: nullableUrl(
      src.successAnimationUrl ?? animations.success,
    ),
    errorAnimationUrl: nullableUrl(src.errorAnimationUrl ?? animations.error),
    emptyStateAnimationUrl: nullableUrl(
      src.emptyStateAnimationUrl ?? animations.empty,
    ),
    selectedAndroidIcon: iconId(src.selectedAndroidIcon ?? appIcon.android),
    selectedIosIcon: iconId(src.selectedIosIcon ?? appIcon.ios),
  };
}

export function toPrismaJson(payload: AppBrandingPayload): Prisma.InputJsonValue {
  return payload as unknown as Prisma.InputJsonValue;
}

export function mapPublicBranding(
  app: AppBrandingAppKey,
  version: number,
  payload: AppBrandingPayload,
  updatedAt: Date,
): AppBrandingPublicView {
  return {
    app,
    version,
    logo: payload.logoUrl,
    colors: {
      primary: payload.primaryColor,
      secondary: payload.secondaryColor,
      background: payload.backgroundColor,
    },
    splash: {
      image: payload.splashImageUrl,
      animation: payload.splashAnimationUrl,
      animationType: payload.splashAnimationType,
      duration: payload.splashDuration,
      enabled: payload.splashAnimationEnabled,
    },
    animations: {
      loading: payload.loadingAnimationUrl,
      home: payload.homeAnimationUrl,
      success: payload.successAnimationUrl,
      error: payload.errorAnimationUrl,
      empty: payload.emptyStateAnimationUrl,
    },
    appIcon: {
      android: payload.selectedAndroidIcon,
      ios: payload.selectedIosIcon,
    },
    updatedAt,
  };
}

export function payloadsEqual(a: AppBrandingPayload, b: AppBrandingPayload): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
