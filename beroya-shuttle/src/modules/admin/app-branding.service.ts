import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  APP_BRANDING_PURPOSES,
  AppBrandingAppKey,
  AppBrandingPurpose,
  assertBrandingMime,
  assertBrandingObjectKey,
  assertBrandingSize,
  assertLottieJson,
  assertNotExecutablePayload,
  assertSafeFileName,
  brandingObjectKey,
  isManagedBrandingKey,
  sniffBrandingMime,
} from '../../infra/storage/app-branding-storage';
import { StorageService } from '../../infra/storage/storage.service';
import {
  BUNDLED_APP_ICONS,
  defaultBrandingPayload,
  mapPublicBranding,
  normalizeBrandingPayload,
  payloadsEqual,
  prismaAppKey,
  publicAppKey,
  toPrismaJson,
  type AppBrandingPayload,
} from './app-branding';
import {
  CompleteAppBrandingUploadDto,
  PresignAppBrandingUploadDto,
  UpdateAppBrandingDto,
} from './dto/update-app-branding.dto';

@Injectable()
export class AppBrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getAdmin(app: AppBrandingAppKey) {
    const row = await this.ensureRow(app);
    const published = normalizeBrandingPayload(row.published);
    const draft = normalizeBrandingPayload(row.draft);
    return {
      app,
      version: row.version,
      published: mapPublicBranding(app, row.version, published, row.updatedAt),
      draft: mapPublicBranding(app, row.version, draft, row.updatedAt),
      hasUnpublishedChanges: !payloadsEqual(published, draft),
      availableIcons: BUNDLED_APP_ICONS,
      updatedAt: row.updatedAt,
    };
  }

  async getPublished(app: AppBrandingAppKey) {
    const row = await this.ensureRow(app);
    return mapPublicBranding(
      app,
      row.version,
      normalizeBrandingPayload(row.published),
      row.updatedAt,
    );
  }

  async saveDraft(app: AppBrandingAppKey, dto: UpdateAppBrandingDto) {
    const row = await this.ensureRow(app);
    const current = normalizeBrandingPayload(row.draft);
    const merged = this.mergeDraft(current, dto);
    await this.assertManagedUrls(app, merged);
    const updated = await this.prisma.platformAppBranding.update({
      where: { appKey: prismaAppKey(app) },
      data: { draft: toPrismaJson(merged) },
    });
    return this.getAdmin(publicAppKey(updated.appKey));
  }

  async publish(app: AppBrandingAppKey) {
    const row = await this.ensureRow(app);
    const draft = normalizeBrandingPayload(row.draft);
    await this.assertManagedUrls(app, draft);
    const nextVersion = row.version + 1;
    await this.prisma.platformAppBranding.update({
      where: { appKey: prismaAppKey(app) },
      data: {
        published: toPrismaJson(draft),
        draft: toPrismaJson(draft),
        version: nextVersion,
      },
    });
    return this.getAdmin(app);
  }

  async presign(app: AppBrandingAppKey, dto: PresignAppBrandingUploadDto) {
    assertSafeFileName(dto.fileName);
    const mime = assertBrandingMime(dto.contentType);
    assertBrandingSize(mime, dto.byteSize);
    this.assertPurposeMime(dto.purpose, mime);
    const key = brandingObjectKey(app, dto.purpose, randomUUID(), mime);
    const uploadUrl = await this.storage.presignPut(key);
    return {
      purpose: dto.purpose,
      objectKey: key,
      uploadUrl,
      method: 'PUT' as const,
      headers: { 'Content-Type': mime },
      expiresIn: this.storage.presignUploadTtlSeconds(),
      maxBytes: dto.byteSize,
      publicUrl: this.storage.publicUrl(key),
    };
  }

  async complete(app: AppBrandingAppKey, dto: CompleteAppBrandingUploadDto) {
    assertBrandingObjectKey(app, dto.objectKey);
    const stat = await this.storage.stat(dto.objectKey);
    if (!stat) {
      throw new AppException(
        'UPLOAD_NOT_FOUND',
        'Upload the file to the presigned URL before completing',
        HttpStatus.NOT_FOUND,
      );
    }
    const buffer = await this.storage.readBuffer(dto.objectKey);
    assertNotExecutablePayload(buffer);
    const sniffed = sniffBrandingMime(buffer);
    if (!sniffed) {
      throw new AppException(
        'BRANDING_UPLOAD_MIME_NOT_ALLOWED',
        'Only JPEG, PNG, WebP, GIF, and Lottie JSON are allowed',
        HttpStatus.BAD_REQUEST,
      );
    }
    assertBrandingSize(sniffed, stat.size);
    this.assertPurposeMime(dto.purpose, sniffed);
    if (sniffed === 'application/json') {
      assertLottieJson(buffer);
      return {
        purpose: dto.purpose,
        objectKey: dto.objectKey,
        url: this.storage.publicUrl(dto.objectKey),
        contentType: sniffed,
        width: null,
        height: null,
        byteSize: stat.size,
      };
    }
    const image = await this.storage.readImage(dto.objectKey);
    return {
      purpose: dto.purpose,
      objectKey: image.key,
      url: this.storage.publicUrl(image.key),
      contentType: sniffed,
      width: image.width,
      height: image.height,
      byteSize: image.byteSize,
    };
  }

  private mergeDraft(
    current: AppBrandingPayload,
    dto: UpdateAppBrandingDto,
  ): AppBrandingPayload {
    return {
      ...current,
      logoUrl:
        dto.logoUrl === undefined ? current.logoUrl : dto.logoUrl || null,
      primaryColor: dto.primaryColor
        ? dto.primaryColor.toUpperCase()
        : current.primaryColor,
      secondaryColor: dto.secondaryColor
        ? dto.secondaryColor.toUpperCase()
        : current.secondaryColor,
      backgroundColor: dto.backgroundColor
        ? dto.backgroundColor.toUpperCase()
        : current.backgroundColor,
      splashImageUrl:
        dto.splash?.imageUrl === undefined
          ? current.splashImageUrl
          : dto.splash.imageUrl || null,
      splashAnimationUrl:
        dto.splash?.animationUrl === undefined
          ? current.splashAnimationUrl
          : dto.splash.animationUrl || null,
      splashAnimationType:
        dto.splash?.animationType ?? current.splashAnimationType,
      splashDuration: dto.splash?.duration ?? current.splashDuration,
      splashAnimationEnabled:
        dto.splash?.enabled ?? current.splashAnimationEnabled,
      loadingAnimationUrl:
        dto.animations?.loading === undefined
          ? current.loadingAnimationUrl
          : dto.animations.loading || null,
      homeAnimationUrl:
        dto.animations?.home === undefined
          ? current.homeAnimationUrl
          : dto.animations.home || null,
      successAnimationUrl:
        dto.animations?.success === undefined
          ? current.successAnimationUrl
          : dto.animations.success || null,
      errorAnimationUrl:
        dto.animations?.error === undefined
          ? current.errorAnimationUrl
          : dto.animations.error || null,
      emptyStateAnimationUrl:
        dto.animations?.empty === undefined
          ? current.emptyStateAnimationUrl
          : dto.animations.empty || null,
      selectedAndroidIcon:
        dto.appIcon?.android ?? current.selectedAndroidIcon,
      selectedIosIcon: dto.appIcon?.ios ?? current.selectedIosIcon,
    };
  }

  private async assertManagedUrls(
    app: AppBrandingAppKey,
    payload: AppBrandingPayload,
  ) {
    const urls = [
      payload.logoUrl,
      payload.splashImageUrl,
      payload.splashAnimationUrl,
      payload.loadingAnimationUrl,
      payload.homeAnimationUrl,
      payload.successAnimationUrl,
      payload.errorAnimationUrl,
      payload.emptyStateAnimationUrl,
    ];
    for (const url of urls) {
      if (!url) continue;
      const key = this.storage.keyFromUrl(url) ?? (url.startsWith('platform/') ? url : null);
      if (!key || !isManagedBrandingKey(key, app)) {
        throw new AppException(
          'APP_BRANDING_ASSET_REQUIRED',
          'The file must be uploaded through app branding',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private assertPurposeMime(
    purpose: AppBrandingPurpose,
    mime: string,
  ): void {
    if (purpose === 'logo' && mime === 'application/json') {
      throw new AppException(
        'BRANDING_UPLOAD_MIME_NOT_ALLOWED',
        'App logo cannot be a Lottie file',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!(APP_BRANDING_PURPOSES as readonly string[]).includes(purpose)) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Invalid upload purpose',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async ensureRow(app: AppBrandingAppKey) {
    const appKey = prismaAppKey(app);
    const existing = await this.prisma.platformAppBranding.findUnique({
      where: { appKey },
    });
    if (existing) return existing;
    const payload = defaultBrandingPayload();
    return this.prisma.platformAppBranding.create({
      data: {
        appKey,
        version: 0,
        published: toPrismaJson(payload),
        draft: toPrismaJson(payload),
      },
    });
  }
}
