import { HttpStatus } from '@nestjs/common';
import { AppException } from '../errors/app.exception';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { normalizeEmail } from './password';

type Db = PrismaService | Prisma.TransactionClient;

export async function assertEmailAvailable(db: Db, email: string, exceptUserId?: string) {
  const clash = await db.shuttleUser.findFirst({
    where: {
      email: normalizeEmail(email),
      archivedAt: null,
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
    },
  });
  if (clash) {
    throw new AppException(
      'EMAIL_IN_USE',
      'This email is already linked to an account',
      HttpStatus.CONFLICT,
    );
  }
}
