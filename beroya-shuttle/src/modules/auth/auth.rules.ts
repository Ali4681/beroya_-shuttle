import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';

export type LoginUser = {
  status: string;
  institution?: { status: string } | null;
};

export function assertUserCanLogin(user: LoginUser): void {
  if (user.status === 'SUSPENDED') {
    throw new AppException(
      'USER_SUSPENDED',
      'This account is suspended',
      HttpStatus.FORBIDDEN,
    );
  }
  if (user.institution?.status === 'SUSPENDED') {
    throw new AppException(
      'INSTITUTION_SUSPENDED',
      'This institution is suspended',
      HttpStatus.FORBIDDEN,
    );
  }
}

export function isRefreshReuse(session: { revokedAt: Date | null }): boolean {
  return session.revokedAt !== null;
}
