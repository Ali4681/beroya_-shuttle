import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { getRequestContext } from '../request-context/request-context';
import { AuthUser } from '../types/auth-user';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user?.institutionId) {
      throw new ForbiddenException({
        code: 'TENANT_REQUIRED',
        message: 'Institution scope is required',
      });
    }

    const store = getRequestContext();
    if (store) {
      store.institutionId = user.institutionId;
      store.branchId = user.branchId;
      store.userId = user.sub;
      store.role = user.role;
    }

    return true;
  }
}
