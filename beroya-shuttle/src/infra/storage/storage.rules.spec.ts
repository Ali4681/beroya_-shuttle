import { AppException } from '../../common/errors/app.exception';
import {
  assertAllowedMime,
  assertDeclaredSize,
  assertOwnedObjectKey,
  assertSquareLogo,
  objectKey,
} from './storage.rules';

describe('storage.rules', () => {
  it('accepts jpeg/png/webp and rejects other types', () => {
    expect(assertAllowedMime('image/png')).toBe('image/png');
    expect(assertAllowedMime('image/jpeg; charset=binary')).toBe('image/jpeg');
    expect(() => assertAllowedMime('application/pdf')).toThrow(AppException);
  });

  it('enforces 2MB logos and 1MB student photos', () => {
    expect(() => assertDeclaredSize('logo', 2 * 1024 * 1024)).not.toThrow();
    expect(() => assertDeclaredSize('logo', 2 * 1024 * 1024 + 1)).toThrow(
      AppException,
    );
    expect(() => assertDeclaredSize('student_photo', 1024 * 1024 + 1)).toThrow(
      AppException,
    );
  });

  it('requires a square logo and ignores shape for student photos', () => {
    expect(() => assertSquareLogo('logo', 256, 256)).not.toThrow();
    expect(() => assertSquareLogo('logo', 256, 128)).toThrow(AppException);
    expect(() => assertSquareLogo('student_photo', 400, 300)).not.toThrow();
  });

  it('scopes object keys to the institution', () => {
    const key = objectKey('inst-1', 'logo', 'abc', 'image/png');
    expect(key).toBe('institutions/inst-1/logos/abc.png');
    expect(() => assertOwnedObjectKey('inst-1', key)).not.toThrow();
    expect(() => assertOwnedObjectKey('inst-2', key)).toThrow(AppException);
  });
});
