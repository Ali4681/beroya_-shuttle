import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { localeFromRequest } from '../i18n';
import { requestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const headerId = req.header('x-request-id');
    const requestId = headerId && headerId.trim() ? headerId : randomUUID();
    res.setHeader('x-request-id', requestId);
    const forwarded = req.header('x-forwarded-for');
    const ipAddress = forwarded
      ? forwarded.split(',')[0].trim()
      : (req.ip ?? req.socket.remoteAddress);
    requestContext.run(
      {
        requestId,
        locale: localeFromRequest(req),
        ipAddress,
        userAgent: req.header('user-agent'),
      },
      () => next(),
    );
  }
}
