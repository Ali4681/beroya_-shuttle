import { AsyncLocalStorage } from 'node:async_hooks';
import { ShuttleRole } from '../../generated/prisma/client';

export type RequestContextStore = {
  requestId: string;
  locale?: 'ar' | 'en';
  userId?: string;
  role?: ShuttleRole;
  institutionId?: string | null;
  branchId?: string | null;
  ipAddress?: string;
  userAgent?: string;
};

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContext.getStore();
}
