jest.mock('../../infra/storage/storage.service', () => ({
  StorageService: class StorageService {},
}));

import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { StorageService } from '../../infra/storage/storage.service';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  const institutionId = '11111111-1111-4111-8111-111111111111';
  const key = `institutions/${institutionId}/logos/abc.png`;
  const storage = {
    presignPut: jest.fn(),
    presignUploadTtlSeconds: jest.fn(() => 900),
    publicUrl: jest.fn(
      (objectKey: string) => `http://localhost:9000/beroya-shuttle/${objectKey}`,
    ),
    keyFromUrl: jest.fn((url: string) =>
      url.startsWith('http://localhost:9000/beroya-shuttle/')
        ? url.slice('http://localhost:9000/beroya-shuttle/'.length)
        : null,
    ),
    stat: jest.fn(),
    readImage: jest.fn(),
  };
  const service = new UploadsService(storage as unknown as StorageService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('presigns a PUT for an allowed image', async () => {
    storage.presignPut.mockResolvedValue('https://minio/put');
    const result = await service.presign(institutionId, {
      purpose: 'logo',
      contentType: 'image/png',
      byteSize: 2048,
    });
    expect(result.method).toBe('PUT');
    expect(result.uploadUrl).toBe('https://minio/put');
    expect(result.objectKey).toMatch(
      new RegExp(`^institutions/${institutionId}/logos/[a-z0-9-]+\\.png$`),
    );
  });

  it('completes a square logo and rejects a rectangle', async () => {
    storage.stat.mockResolvedValue({ size: 120 });
    storage.readImage.mockResolvedValue({
      key,
      byteSize: 120,
      width: 64,
      height: 64,
    });
    const ok = await service.complete(institutionId, {
      purpose: 'logo',
      objectKey: key,
    });
    expect(ok.width).toBe(64);

    storage.readImage.mockResolvedValue({
      key,
      byteSize: 120,
      width: 64,
      height: 32,
    });
    try {
      await service.complete(institutionId, { purpose: 'logo', objectKey: key });
      fail('expected LOGO_NOT_SQUARE');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'LOGO_NOT_SQUARE',
      });
    }
  });

  it('rejects an external branding logo_url', async () => {
    try {
      await service.assertLogoUrl(institutionId, 'https://evil.example/logo.png');
      fail('expected LOGO_MUST_BE_UPLOADED');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'LOGO_MUST_BE_UPLOADED',
      });
    }
  });
});
