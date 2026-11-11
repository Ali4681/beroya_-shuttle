import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { keysToCamelCase, keysToSnakeCase } from '../utils/case-transform';

type WrappedResponse = {
  data: unknown;
  meta?: unknown;
};

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    this.normalizeIncoming(request);

    return next
      .handle()
      .pipe(
        map((payload: unknown) => keysToSnakeCase(this.wrapResponse(payload))),
      );
  }

  private normalizeIncoming(request: Request): void {
    const body: unknown = request.body;
    if (body && typeof body === 'object') {
      request.body = keysToCamelCase(body);
    }

    if (request.query && typeof request.query === 'object') {
      const camelQuery = keysToCamelCase({
        ...request.query,
      }) as Request['query'];
      Object.defineProperty(request, 'query', {
        value: camelQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  }

  private wrapResponse(payload: unknown): WrappedResponse {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      const envelope = payload as { data: unknown; meta?: unknown };
      if (Array.isArray(envelope.data) || 'meta' in envelope) {
        return envelope;
      }
    }
    return { data: payload };
  }
}
