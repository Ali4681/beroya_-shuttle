import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus,
    details: Record<string, unknown> = {},
  ) {
    super({ code, message, details }, status);
  }
}
