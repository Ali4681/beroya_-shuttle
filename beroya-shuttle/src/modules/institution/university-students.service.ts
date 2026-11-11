import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { assertEmailAvailable } from '../../common/utils/email-availability';
import { assertEmailAndPassword, hashPassword, normalizeEmail } from '../../common/utils/password';
import { normalizePhone } from '../../common/utils/phone';
import {
  Prisma,
  ShuttleRole,
  StudentStatus,
  UserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../admin/admin.constants';
import { AuditService } from '../shared/audit/audit.service';
import { CreateUniversityStudentDto } from './dto/create-university-student.dto';
import { ListUniversityStudentsQueryDto } from './dto/list-university-students.query';
import { UpdateUniversityStudentDto } from './dto/update-university-student.dto';
import { PeopleUsersService } from './people-users.service';
import { mapUniversityStudent } from './people.mapper';

const profileInclude = { user: true } as const;

@Injectable()
export class UniversityStudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly people: PeopleUsersService,
  ) {}

  async list(institutionId: string, query: ListUniversityStudentsQueryDto) {
    const where: Prisma.UniversityStudentProfileWhereInput = {
      institutionId,
      archivedAt: null,
    };
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { studentNumber: { contains: search, mode: 'insensitive' } },
        { faculty: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search } } },
      ];
    }
    const total = await this.prisma.universityStudentProfile.count({ where });
    const rows = await this.prisma.universityStudentProfile.findMany({
      where,
      include: profileInclude,
      orderBy: { createdAt: 'desc' },
      skip: paginationOffset(query.page, query.limit),
      take: query.limit,
    });
    return {
      data: rows.map(mapUniversityStudent),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async stats(institutionId: string) {
    const base = { institutionId, archivedAt: null };
    const [total, active, inactive] = await Promise.all([
      this.prisma.universityStudentProfile.count({ where: base }),
      this.prisma.universityStudentProfile.count({
        where: { ...base, status: StudentStatus.ACTIVE },
      }),
      this.prisma.universityStudentProfile.count({
        where: { ...base, status: StudentStatus.INACTIVE },
      }),
    ]);
    return { total, active, inactive };
  }

  async create(
    actorUserId: string,
    institutionId: string,
    dto: CreateUniversityStudentDto,
  ) {
    if (dto.branchId) {
      await this.people.requireBranch(institutionId, dto.branchId);
    }
    const phone = normalizePhone(dto.phone);
    assertEmailAndPassword(dto.email, dto.password);
    const email = normalizeEmail(dto.email);
    const passwordHash = await hashPassword(dto.password);
    await this.people.assertPhoneAvailable(phone);
    await assertEmailAvailable(this.prisma, email);
    if (dto.studentNumber) {
      await this.assertStudentNumberFree(institutionId, dto.studentNumber);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.shuttleUser.create({
        data: {
          fullName: dto.fullName,
          phone,
          email,
          passwordHash,
          role: ShuttleRole.UNIVERSITY_STUDENT,
          status: UserStatus.ACTIVE,
          institutionId,
          branchId: dto.branchId,
        },
      });
      const profile = await tx.universityStudentProfile.create({
        data: {
          userId: user.id,
          institutionId,
          branchId: dto.branchId,
          studentNumber: dto.studentNumber,
          faculty: dto.faculty,
        },
        include: profileInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.UNIVERSITY_STUDENT_CREATED,
          entityType: ENTITY.UNIVERSITY_STUDENT,
          entityId: profile.id,
          after: mapUniversityStudent(profile),
        },
        tx,
      );
      return profile;
    });
    return mapUniversityStudent(created);
  }

  async getById(institutionId: string, id: string) {
    return mapUniversityStudent(await this.findOwned(institutionId, id));
  }

  async update(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: UpdateUniversityStudentDto,
  ) {
    const current = await this.findOwned(institutionId, id);
    if (dto.branchId) {
      await this.people.requireBranch(institutionId, dto.branchId);
    }
    if (dto.phone) {
      await this.people.assertPhoneAvailable(
        normalizePhone(dto.phone),
        current.userId,
      );
    }
    if (dto.email) await assertEmailAvailable(this.prisma, dto.email, current.userId);
    const passwordHash = dto.password ? await hashPassword(dto.password) : undefined;
    if (dto.studentNumber && dto.studentNumber !== current.studentNumber) {
      await this.assertStudentNumberFree(institutionId, dto.studentNumber, id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.fullName || dto.phone || dto.branchId || dto.email || passwordHash) {
        await tx.shuttleUser.update({
          where: { id: current.userId },
          data: {
            fullName: dto.fullName,
            phone: dto.phone ? normalizePhone(dto.phone) : undefined,
            email: dto.email ? normalizeEmail(dto.email) : undefined,
            passwordHash,
            branchId: dto.branchId,
          },
        });
      }
      const next = await tx.universityStudentProfile.update({
        where: { id },
        data: {
          studentNumber: dto.studentNumber,
          faculty: dto.faculty,
          branchId: dto.branchId,
        },
        include: profileInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.UNIVERSITY_STUDENT_UPDATED,
          entityType: ENTITY.UNIVERSITY_STUDENT,
          entityId: id,
          before: mapUniversityStudent(current),
          after: mapUniversityStudent(next),
        },
        tx,
      );
      return next;
    });
    return mapUniversityStudent(updated);
  }

  async updateStatus(
    actorUserId: string,
    institutionId: string,
    id: string,
    status: StudentStatus,
  ) {
    const current = await this.findOwned(institutionId, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.universityStudentProfile.update({
        where: { id },
        data: { status },
        include: profileInclude,
      });
      await tx.shuttleUser.update({
        where: { id: current.userId },
        data: {
          status:
            status === StudentStatus.ACTIVE
              ? UserStatus.ACTIVE
              : UserStatus.SUSPENDED,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.UNIVERSITY_STUDENT_STATUS_CHANGED,
          entityType: ENTITY.UNIVERSITY_STUDENT,
          entityId: id,
          before: { status: current.status },
          after: { status: next.status },
        },
        tx,
      );
      return next;
    });
    return mapUniversityStudent(updated);
  }

  private async findOwned(institutionId: string, id: string) {
    const profile = await this.prisma.universityStudentProfile.findFirst({
      where: { id, institutionId, archivedAt: null },
      include: profileInclude,
    });
    if (!profile) {
      throw new AppException(
        'UNIVERSITY_STUDENT_NOT_FOUND',
        'University student not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return profile;
  }

  private async assertStudentNumberFree(
    institutionId: string,
    studentNumber: string,
    exceptId?: string,
  ) {
    const clash = await this.prisma.universityStudentProfile.findFirst({
      where: {
        institutionId,
        studentNumber,
        archivedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (clash) {
      throw new AppException(
        'STUDENT_NUMBER_IN_USE',
        'This student number is already used',
        HttpStatus.CONFLICT,
      );
    }
  }
}
