import { ShuttleRole } from '../../generated/prisma/client';

export type AuthUser = {
  sub: string;
  role: ShuttleRole;
  institutionId: string | null;
  branchId: string | null;
  sessionId: string;
};
