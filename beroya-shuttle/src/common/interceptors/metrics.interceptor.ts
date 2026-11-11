import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from '../../infra/metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = process.hrtime.bigint();
    return next.handle().pipe(
      tap({
        next: () => this.record(request, response, started),
        error: () => this.record(request, response, started),
      }),
    );
  }

  private record(request: Request, response: Response, started: bigint) {
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    const route = request.route?.path ?? request.path ?? 'unknown';
    this.metrics.observeHttp(
      request.method,
      String(route),
      response.statusCode || 500,
      seconds,
    );
  }
}
