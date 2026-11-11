import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { AppException } from '../errors/app.exception';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ url?: string }>();
    const url = request.url ?? '';
    return (
      url.startsWith('/health') ||
      url.startsWith('/metrics') ||
      url.includes('/docs')
    );
  }

  protected throwThrottlingException(
    _context: ExecutionContext,
    _detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new AppException(
      'RATE_LIMITED',
      'Too many requests',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
