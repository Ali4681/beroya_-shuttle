import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../infra/redis/redis.service';
import { AuthUser } from '../types/auth-user';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const header = request.header('idempotency-key')?.trim();
    if (!header) {
      return next.handle();
    }

    const actor = request.user?.sub ?? 'anon';
    const cacheKey = `idem:${actor}:${request.method}:${request.path}:${header}`;
    const hit = await this.redis.get(cacheKey);
    if (hit) {
      return of(JSON.parse(hit) as unknown);
    }

    return next.handle().pipe(
      tap((payload) => {
        void this.redis.set(
          cacheKey,
          JSON.stringify(payload),
          IDEMPOTENCY_TTL_SECONDS,
        );
      }),
    );
  }
}
