export const ALLOWED_UPLOAD_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIME)[number];

export const UPLOAD_PURPOSES = ['logo', 'student_photo'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const STUDENT_PHOTO_MAX_BYTES = 1024 * 1024;
export const PRESIGN_TTL_SECONDS = 15 * 60;

export const MIME_EXTENSION: Record<AllowedUploadMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
