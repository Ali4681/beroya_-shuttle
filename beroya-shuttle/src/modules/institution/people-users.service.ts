import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { assertEmailAvailable } from '../../common/utils/email-availability';
import { assertEmailAndPassword, hashPassword, normalizeEmail } from '../../common/utils/password';
import { normalizePhone } from '../../common/utils/phone';
import {
  Prisma,
  ResourceStatus,
  ShuttleRole,
  UserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PeopleUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async requireBranch(institutionId: string, branchId: string, db: Db = this.prisma) {
    const branch = await db.institutionBranch.findFirst({
      where: { id: branchId, institutionId, archivedAt: null },
    });
    if (!branch) {
      throw new AppException(
        'BRANCH_NOT_FOUND',
        'Branch not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return branch;
  }

  async requireMeetingPoint(
    institutionId: string,
    meetingPointId: string,
    db: Db = this.prisma,
  ) {
    const point = await db.meetingPoint.findFirst({
      where: {
        id: meetingPointId,
        institutionId,
        archivedAt: null,
        status: ResourceStatus.ACTIVE,
      },
    });
    if (!point) {
      throw new AppException(
        'MEETING_POINT_NOT_FOUND',
        'Meeting point not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return point;
  }

  async findOrCreateParent(
    institutionId: string,
    input: { fullName: string; phone: string; email: string; password: string },
    db: Db = this.prisma,
  ) {
    const phone = normalizePhone(input.phone);
    assertEmailAndPassword(input.email, input.password);
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const existing = await db.shuttleUser.findFirst({
      where: { phone, institutionId, archivedAt: null },
    });
    if (existing) {
      if (existing.role !== ShuttleRole.PARENT) {
        throw new AppException(
          'PHONE_IN_USE',
          'This phone is already linked to another account in the institution',
          HttpStatus.CONFLICT,
        );
      }
      await assertEmailAvailable(db, email, existing.id);
      return db.shuttleUser.update({
        where: { id: existing.id },
        data: { fullName: input.fullName, email, passwordHash },
      });
    }

    await this.assertPhoneAvailable(phone, undefined, db);
    await assertEmailAvailable(db, email);
    return db.shuttleUser.create({
      data: {
        fullName: input.fullName,
        phone,
        email,
        passwordHash,
        role: ShuttleRole.PARENT,
        status: UserStatus.ACTIVE,
        institutionId,
      },
    });
  }

  async assertPhoneAvailable(phone: string, exceptUserId?: string, db: Db = this.prisma) {
    const clash = await db.shuttleUser.findFirst({
      where: {
        phone,
        archivedAt: null,
        status: UserStatus.ACTIVE,
        ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
      },
    });
    if (clash) {
      throw new AppException(
        'PHONE_IN_USE',
        'This phone is already linked to an active account',
        HttpStatus.CONFLICT,
      );
    }
  }

  async revokeAccess(userId: string, db: Db = this.prisma): Promise<void> {
    await db.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await db.userDevice.deleteMany({ where: { userId } });
  }
}
