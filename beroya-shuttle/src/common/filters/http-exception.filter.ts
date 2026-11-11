import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import {
  localeFromRequest,
  translateError,
  translateValidationMessage,
  type AppLocale,
} from '../i18n';
import { getRequestContext } from '../request-context/request-context';

type ErrorBody = {
  code?: string;
  message?: string | string[];
  details?: Record<string, unknown>;
  error?: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const locale: AppLocale =
      getRequestContext()?.locale ?? localeFromRequest(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = translateError(code, undefined, locale);
    let details: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        code = HttpStatus[status] ?? 'ERROR';
        message = translateError(code, payload, locale);
      } else if (payload && typeof payload === 'object') {
        const body = payload as ErrorBody;
        if (Array.isArray(body.message)) {
          code = 'VALIDATION_ERROR';
          message = translateError(code, 'Validation failed', locale);
          details = {
            errors: body.message.map((item) =>
              translateValidationMessage(String(item), locale),
            ),
          };
        } else {
          code = body.code ?? HttpStatus[status] ?? 'ERROR';
          message = translateError(code, body.message ?? exception.message, locale);
          details = body.details ?? {};
          if (Array.isArray(details.errors)) {
            details = {
              ...details,
              errors: details.errors.map((item) =>
                translateValidationMessage(String(item), locale),
              ),
            };
          }
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `${request.method} ${request.url} ${exception.message}`,
        exception.stack,
      );
      Sentry.captureException(exception, {
        extra: { requestId: getRequestContext()?.requestId },
      });
    } else {
      this.logger.error(`${request.method} ${request.url} unknown error`);
    }

    if (
      status >= HttpStatus.INTERNAL_SERVER_ERROR &&
      exception instanceof HttpException
    ) {
      this.logger.error(`${request.method} ${request.url} ${message}`);
    }

    response.status(status).json({
      error: {
        code,
        message,
        details,
      },
    });
  }
}
