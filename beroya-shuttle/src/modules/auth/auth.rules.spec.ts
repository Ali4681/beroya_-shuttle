import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { assertUserCanLogin, isRefreshReuse } from './auth.rules';

describe('auth.rules', () => {
  it('rejects a user whose institution is suspended', () => {
    try {
      assertUserCanLogin({
        status: 'ACTIVE',
        institution: { status: 'SUSPENDED' },
      });
      fail('expected INSTITUTION_SUSPENDED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'INSTITUTION_SUSPENDED',
      });
    }
  });

  it('rejects a suspended user', () => {
    try {
      assertUserCanLogin({ status: 'SUSPENDED', institution: null });
      fail('expected USER_SUSPENDED');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'USER_SUSPENDED',
      });
    }
  });

  it('allows an active user without a suspended institution', () => {
    expect(() =>
      assertUserCanLogin({ status: 'ACTIVE', institution: null }),
    ).not.toThrow();
    expect(() =>
      assertUserCanLogin({
        status: 'ACTIVE',
        institution: { status: 'ACTIVE' },
      }),
    ).not.toThrow();
  });

  it('detects refresh token reuse', () => {
    expect(isRefreshReuse({ revokedAt: new Date() })).toBe(true);
    expect(isRefreshReuse({ revokedAt: null })).toBe(false);
  });
});
