import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  ALLOWED_UPLOAD_MIME,
  AllowedUploadMime,
  LOGO_MAX_BYTES,
  MIME_EXTENSION,
  STUDENT_PHOTO_MAX_BYTES,
  UploadPurpose,
} from './storage.constants';

export function maxBytesFor(purpose: UploadPurpose): number {
  return purpose === 'logo' ? LOGO_MAX_BYTES : STUDENT_PHOTO_MAX_BYTES;
}

export function assertAllowedMime(contentType: string): AllowedUploadMime {
  const normalized = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  if (!ALLOWED_UPLOAD_MIME.includes(normalized as AllowedUploadMime)) {
    throw new AppException(
      'UPLOAD_MIME_NOT_ALLOWED',
      'Only JPEG, PNG, and WebP images are allowed',
      HttpStatus.BAD_REQUEST,
      { allowed: [...ALLOWED_UPLOAD_MIME] },
    );
  }
  return normalized as AllowedUploadMime;
}

export function assertDeclaredSize(
  purpose: UploadPurpose,
  byteSize: number,
): void {
  const max = maxBytesFor(purpose);
  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > max) {
    throw new AppException(
      'UPLOAD_TOO_LARGE',
      purpose === 'logo'
        ? 'Logo must be at most 2MB'
        : 'Student photo must be at most 1MB',
      HttpStatus.BAD_REQUEST,
      { max_bytes: max, byte_size: byteSize },
    );
  }
}

export function assertSquareLogo(
  purpose: UploadPurpose,
  width: number,
  height: number,
): void {
  if (purpose !== 'logo') {
    return;
  }
  if (!width || !height || width !== height) {
    throw new AppException(
      'LOGO_NOT_SQUARE',
      'Institution logo must be a square image',
      HttpStatus.BAD_REQUEST,
      { width, height },
    );
  }
}

export function extensionForMime(contentType: AllowedUploadMime): string {
  return MIME_EXTENSION[contentType];
}

export function objectKey(
  institutionId: string,
  purpose: UploadPurpose,
  objectId: string,
  contentType: AllowedUploadMime,
): string {
  const folder = purpose === 'logo' ? 'logos' : 'students';
  return `institutions/${institutionId}/${folder}/${objectId}.${extensionForMime(contentType)}`;
}

export function assertOwnedObjectKey(
  institutionId: string,
  key: string,
): void {
  const prefix = `institutions/${institutionId}/`;
  if (!key.startsWith(prefix) || key.includes('..')) {
    throw new AppException(
      'UPLOAD_KEY_FORBIDDEN',
      'This file does not belong to the institution',
      HttpStatus.FORBIDDEN,
    );
  }
}
