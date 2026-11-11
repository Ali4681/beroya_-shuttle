import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppException } from '../../common/errors/app.exception';
import {
  assertAllowedMime,
  assertDeclaredSize,
  assertOwnedObjectKey,
  assertSquareLogo,
  objectKey,
} from '../../infra/storage/storage.rules';
import { StorageService } from '../../infra/storage/storage.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { PresignUploadDto } from './dto/presign-upload.dto';

@Injectable()
export class UploadsService {
  constructor(private readonly storage: StorageService) {}

  async presign(institutionId: string, dto: PresignUploadDto) {
    const mime = assertAllowedMime(dto.contentType);
    assertDeclaredSize(dto.purpose, dto.byteSize);
    const key = objectKey(institutionId, dto.purpose, randomUUID(), mime);
    const uploadUrl = await this.storage.presignPut(key);
    return {
      purpose: dto.purpose,
      objectKey: key,
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': mime },
      expiresIn: this.storage.presignUploadTtlSeconds(),
      maxBytes: dto.byteSize,
      publicUrl: this.storage.publicUrl(key),
    };
  }

  async complete(institutionId: string, dto: CompleteUploadDto) {
    assertOwnedObjectKey(institutionId, dto.objectKey);
    const stat = await this.storage.stat(dto.objectKey);
    if (!stat) {
      throw new AppException(
        'UPLOAD_NOT_FOUND',
        'Upload the file to the presigned URL before completing',
        HttpStatus.NOT_FOUND,
      );
    }
    assertDeclaredSize(dto.purpose, stat.size);
    const image = await this.storage.readImage(dto.objectKey);
    assertSquareLogo(dto.purpose, image.width, image.height);
    return {
      purpose: dto.purpose,
      objectKey: image.key,
      url: this.storage.publicUrl(image.key),
      width: image.width,
      height: image.height,
      byteSize: image.byteSize,
    };
  }

  async assertLogoUrl(institutionId: string, logoUrl: string): Promise<void> {
    const key = this.resolveOwnedKey(logoUrl);
    if (!key) {
      throw new AppException(
        'LOGO_MUST_BE_UPLOADED',
        'Set logo_url from POST /uploads/complete after a square logo upload',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.complete(institutionId, { purpose: 'logo', objectKey: key });
  }

  async assertManagedPhotoUrl(
    institutionId: string,
    photoUrl: string | undefined,
  ): Promise<void> {
    if (!photoUrl) {
      return;
    }
    const key = this.resolveOwnedKey(photoUrl);
    if (!key) {
      return;
    }
    await this.complete(institutionId, {
      purpose: 'student_photo',
      objectKey: key,
    });
  }

  private resolveOwnedKey(value: string): string | null {
    return (
      this.storage.keyFromUrl(value) ??
      (value.startsWith('institutions/') ? value : null)
    );
  }
}
