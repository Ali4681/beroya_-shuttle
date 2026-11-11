import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { keysToCamelCase } from '../utils/case-transform';

@Injectable()
export class CaseTransformMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (req.body && typeof req.body === 'object') {
      req.body = keysToCamelCase(req.body);
    }

    if (req.query && typeof req.query === 'object') {
      Object.defineProperty(req, 'query', {
        value: keysToCamelCase({ ...req.query }),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  }
}
