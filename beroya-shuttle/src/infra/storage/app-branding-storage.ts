import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';

export const APP_BRANDING_APPS = ['passenger', 'crew'] as const;
export type AppBrandingAppKey = (typeof APP_BRANDING_APPS)[number];

export const APP_BRANDING_PURPOSES = [
  'logo',
  'splash_image',
  'splash_animation',
  'loading_animation',
  'home_animation',
  'success_animation',
  'error_animation',
  'empty_animation',
] as const;
export type AppBrandingPurpose = (typeof APP_BRANDING_PURPOSES)[number];

export const APP_BRANDING_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const APP_BRANDING_ALLOWED_MIME = [
  ...APP_BRANDING_IMAGE_MIME,
  'application/json',
] as const;
export type AppBrandingMime = (typeof APP_BRANDING_ALLOWED_MIME)[number];

export const APP_ICON_COUNT = 20;
export const APP_ICON_IDS = Array.from(
  { length: APP_ICON_COUNT },
  (_, index) => `icon_${String(index + 1).padStart(2, '0')}`,
);
export type AppIconId = (typeof APP_ICON_IDS)[number];

export const SPLASH_ANIMATION_TYPES = ['none', 'image', 'gif', 'lottie'] as const;
export type SplashAnimationType = (typeof SPLASH_ANIMATION_TYPES)[number];

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const GIF_MAX_BYTES = 5 * 1024 * 1024;
export const LOTTIE_MAX_BYTES = 2 * 1024 * 1024;
export const BLOCKED_UPLOAD_EXTENSIONS = [
  'exe',
  'dll',
  'apk',
  'aab',
  'ipa',
  'php',
  'js',
  'html',
  'htm',
  'svg',
] as const;

const MIME_EXTENSION: Record<AppBrandingMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/json': 'json',
};

export function isAppBrandingAppKey(value: string): value is AppBrandingAppKey {
  return (APP_BRANDING_APPS as readonly string[]).includes(value);
}

export function isAppIconId(value: string): value is AppIconId {
  return (APP_ICON_IDS as readonly string[]).includes(value);
}

export function maxBytesForBranding(mime: AppBrandingMime): number {
  if (mime === 'image/gif') return GIF_MAX_BYTES;
  if (mime === 'application/json') return LOTTIE_MAX_BYTES;
  return IMAGE_MAX_BYTES;
}

export function assertBrandingMime(contentType: string): AppBrandingMime {
  const normalized = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  if (!(APP_BRANDING_ALLOWED_MIME as readonly string[]).includes(normalized)) {
    throw new AppException(
      'BRANDING_UPLOAD_MIME_NOT_ALLOWED',
      'Only JPEG, PNG, WebP, GIF, and Lottie JSON are allowed',
      HttpStatus.BAD_REQUEST,
      { allowed: [...APP_BRANDING_ALLOWED_MIME] },
    );
  }
  return normalized as AppBrandingMime;
}

export function assertBrandingSize(mime: AppBrandingMime, byteSize: number): void {
  const max = maxBytesForBranding(mime);
  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > max) {
    throw new AppException(
      'UPLOAD_TOO_LARGE',
      'The file is too large',
      HttpStatus.BAD_REQUEST,
      { max_bytes: max, byte_size: byteSize },
    );
  }
}

export function assertSafeFileName(fileName?: string): void {
  if (!fileName) return;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if ((BLOCKED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AppException(
      'BRANDING_UPLOAD_MIME_NOT_ALLOWED',
      'This file type is not allowed',
      HttpStatus.BAD_REQUEST,
      { extension: ext },
    );
  }
}

export function brandingObjectKey(
  app: AppBrandingAppKey,
  purpose: AppBrandingPurpose,
  objectId: string,
  mime: AppBrandingMime,
): string {
  return `platform/app-branding/${app}/${purpose}/${objectId}.${MIME_EXTENSION[mime]}`;
}

export function assertBrandingObjectKey(
  app: AppBrandingAppKey,
  key: string,
): void {
  const prefix = `platform/app-branding/${app}/`;
  if (!key.startsWith(prefix) || key.includes('..')) {
    throw new AppException(
      'UPLOAD_KEY_FORBIDDEN',
      'This file does not belong to app branding',
      HttpStatus.FORBIDDEN,
    );
  }
}

export function isManagedBrandingKey(key: string, app: AppBrandingAppKey): boolean {
  return key.startsWith(`platform/app-branding/${app}/`) && !key.includes('..');
}

export function sniffBrandingMime(buffer: Buffer): AppBrandingMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (
    buffer.length >= 6 &&
    (buffer.toString('ascii', 0, 6) === 'GIF87a' ||
      buffer.toString('ascii', 0, 6) === 'GIF89a')
  ) {
    return 'image/gif';
  }
  const start = buffer
    .subarray(0, Math.min(buffer.length, 32))
    .toString('utf8')
    .trimStart();
  if (start.startsWith('{') || start.startsWith('[')) {
    return 'application/json';
  }
  return null;
}

export function assertNotExecutablePayload(buffer: Buffer): void {
  const head = buffer.subarray(0, Math.min(buffer.length, 64)).toString('utf8');
  if (
    /^MZ/.test(head) ||
    head.includes('<?php') ||
    /<\s*(html|script|iframe)/i.test(head)
  ) {
    throw new AppException(
      'BRANDING_UPLOAD_MIME_NOT_ALLOWED',
      'This file type is not allowed',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export function assertLottieJson(buffer: Buffer): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new AppException(
      'BRANDING_UPLOAD_INVALID_LOTTIE',
      'The file is not valid Lottie JSON',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !('layers' in parsed)
  ) {
    throw new AppException(
      'BRANDING_UPLOAD_INVALID_LOTTIE',
      'The file is not valid Lottie JSON',
      HttpStatus.BAD_REQUEST,
    );
  }
}
