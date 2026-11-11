import { AppException } from '../../common/errors/app.exception';
import {
  assertBrandingMime,
  assertBrandingObjectKey,
  assertBrandingSize,
  assertLottieJson,
  assertNotExecutablePayload,
  brandingObjectKey,
  sniffBrandingMime,
} from './app-branding-storage';

describe('app-branding-storage', () => {
  it('accepts image and lottie mime types and rejects executables', () => {
    expect(assertBrandingMime('image/gif')).toBe('image/gif');
    expect(assertBrandingMime('application/json')).toBe('application/json');
    expect(() => assertBrandingMime('application/x-msdownload')).toThrow(
      AppException,
    );
    expect(() => assertBrandingMime('text/html')).toThrow(AppException);
  });

  it('enforces gif and lottie size limits', () => {
    expect(() => assertBrandingSize('image/gif', 5 * 1024 * 1024)).not.toThrow();
    expect(() => assertBrandingSize('image/gif', 5 * 1024 * 1024 + 1)).toThrow(
      AppException,
    );
    expect(() =>
      assertBrandingSize('application/json', 2 * 1024 * 1024 + 1),
    ).toThrow(AppException);
  });

  it('scopes object keys to the flutter app', () => {
    const key = brandingObjectKey('passenger', 'logo', 'abc', 'image/png');
    expect(key).toBe('platform/app-branding/passenger/logo/abc.png');
    expect(() => assertBrandingObjectKey('passenger', key)).not.toThrow();
    expect(() => assertBrandingObjectKey('crew', key)).toThrow(AppException);
  });

  it('sniffs gif and jpeg magic bytes', () => {
    expect(sniffBrandingMime(Buffer.from('GIF89a....'))).toBe('image/gif');
    expect(sniffBrandingMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
    expect(sniffBrandingMime(Buffer.from('<?php echo 1;'))).toBeNull();
    expect(() =>
      assertNotExecutablePayload(Buffer.from('<?php echo 1;')),
    ).toThrow(AppException);
  });

  it('requires lottie layers', () => {
    expect(() =>
      assertLottieJson(Buffer.from(JSON.stringify({ v: '5.7', layers: [] }))),
    ).not.toThrow();
    expect(() => assertLottieJson(Buffer.from('{"hello":1}'))).toThrow(
      AppException,
    );
  });
});
