import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPaginationMeta,
  PaginationDto,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { normalizePhone } from '../../common/utils/phone';
import {
  PickupType,
  Prisma,
  RouteStatus,
  StudentStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../admin/admin.constants';
import { AuditService } from '../shared/audit/audit.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { GuardianDto } from './dto/guardian.dto';
import { ListStudentsQueryDto } from './dto/list-students.query';
import { PickupDto } from './dto/pickup.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { PeopleUsersService } from './people-users.service';
import { UploadsService } from './uploads.service';
import {
  boardingTimestamp,
  mapStudentDetail,
  mapStudentTrip,
} from './people.mapper';
import { normalizePickup } from './people.rules';

const studentInclude = {
  guardianUser: true,
  pickupConfig: { include: { meetingPoint: true } },
  routeAssignments: {
    where: { isActive: true },
    include: { route: { select: { id: true, name: true, status: true } } },
  },
} as const;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly people: PeopleUsersService,
    private readonly uploads: UploadsService,
  ) {}

  async list(institutionId: string, query: ListStudentsQueryDto) {
    const where = this.buildWhere(institutionId, query);
    const total = await this.prisma.schoolStudent.count({ where });
    const rows = await this.prisma.schoolStudent.findMany({
      where,
      include: studentInclude,
      orderBy: { fullName: 'asc' },
      skip: paginationOffset(query.page, query.limit),
      take: query.limit,
    });
    return {
      data: rows.map(mapStudentDetail),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async stats(institutionId: string) {
    const base = { institutionId, archivedAt: null };
    const [total, active, withoutRoute, homePickup, meetingPointPickup] =
      await Promise.all([
        this.prisma.schoolStudent.count({ where: base }),
        this.prisma.schoolStudent.count({
          where: { ...base, status: StudentStatus.ACTIVE },
        }),
        this.prisma.schoolStudent.count({
          where: {
            ...base,
            routeAssignments: {
              none: {
                isActive: true,
                route: { status: RouteStatus.ACTIVE, archivedAt: null },
              },
            },
          },
        }),
        this.prisma.schoolStudent.count({
          where: { ...base, pickupConfig: { pickupType: PickupType.HOME } },
        }),
        this.prisma.schoolStudent.count({
          where: {
            ...base,
            pickupConfig: { pickupType: PickupType.MEETING_POINT },
          },
        }),
      ]);
    return { total, active, withoutRoute, homePickup, meetingPointPickup };
  }

  async create(actorUserId: string, institutionId: string, dto: CreateStudentDto) {
    await this.people.requireBranch(institutionId, dto.branchId);
    await this.uploads.assertManagedPhotoUrl(institutionId, dto.photoUrl);
    const pickup = normalizePickup(dto.pickup);
    if (pickup.meetingPointId) {
      await this.people.requireMeetingPoint(institutionId, pickup.meetingPointId);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const guardian = await this.people.findOrCreateParent(
        institutionId,
        dto.guardian,
        tx,
      );
      const student = await tx.schoolStudent.create({
        data: {
          institutionId,
          branchId: dto.branchId,
          fullName: dto.fullName,
          grade: dto.grade,
          section: dto.section,
          photoUrl: dto.photoUrl,
          subscriptionType: dto.subscriptionType,
          guardianUserId: guardian.id,
          pickupConfig: {
            create: {
              pickupType: pickup.pickupType,
              meetingPointId: pickup.meetingPointId,
              latitude: pickup.latitude,
              longitude: pickup.longitude,
              addressLabel: dto.pickup.addressLabel,
            },
          },
        },
        include: studentInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.STUDENT_CREATED,
          entityType: ENTITY.SCHOOL_STUDENT,
          entityId: student.id,
          after: mapStudentDetail(student),
        },
        tx,
      );
      return student;
    });
    return mapStudentDetail(created);
  }

  async getById(institutionId: string, id: string) {
    return mapStudentDetail(await this.findOwned(institutionId, id));
  }

  async update(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: UpdateStudentDto,
  ) {
    const current = await this.findOwned(institutionId, id);
    if (dto.branchId) {
      await this.people.requireBranch(institutionId, dto.branchId);
    }
    await this.uploads.assertManagedPhotoUrl(institutionId, dto.photoUrl);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.schoolStudent.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          branchId: dto.branchId,
          grade: dto.grade,
          section: dto.section,
          photoUrl: dto.photoUrl,
          subscriptionType: dto.subscriptionType,
        },
        include: studentInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.STUDENT_UPDATED,
          entityType: ENTITY.SCHOOL_STUDENT,
          entityId: id,
          before: mapStudentDetail(current),
          after: mapStudentDetail(next),
        },
        tx,
      );
      return next;
    });
    return mapStudentDetail(updated);
  }

  async updateStatus(
    actorUserId: string,
    institutionId: string,
    id: string,
    status: StudentStatus,
  ) {
    const current = await this.findOwned(institutionId, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.schoolStudent.update({
        where: { id },
        data: { status },
        include: studentInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.STUDENT_STATUS_CHANGED,
          entityType: ENTITY.SCHOOL_STUDENT,
          entityId: id,
          before: { status: current.status },
          after: { status: next.status },
        },
        tx,
      );
      return next;
    });
    return mapStudentDetail(updated);
  }

  async updateGuardian(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: GuardianDto,
  ) {
    const current = await this.findOwned(institutionId, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const guardian = await this.people.findOrCreateParent(
        institutionId,
        dto,
        tx,
      );
      const next = await tx.schoolStudent.update({
        where: { id },
        data: { guardianUserId: guardian.id },
        include: studentInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.STUDENT_GUARDIAN_CHANGED,
          entityType: ENTITY.SCHOOL_STUDENT,
          entityId: id,
          before: { guardianUserId: current.guardianUserId },
          after: {
            guardianUserId: guardian.id,
            phone: normalizePhone(dto.phone),
          },
        },
        tx,
      );
      return next;
    });
    return mapStudentDetail(updated);
  }

  async updatePickup(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: PickupDto,
  ) {
    const current = await this.findOwned(institutionId, id);
    const pickup = normalizePickup(dto);
    if (pickup.meetingPointId) {
      await this.people.requireMeetingPoint(institutionId, pickup.meetingPointId);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.studentPickupConfig.upsert({
        where: { studentId: id },
        create: {
          studentId: id,
          pickupType: pickup.pickupType,
          meetingPointId: pickup.meetingPointId,
          latitude: pickup.latitude,
          longitude: pickup.longitude,
          addressLabel: dto.addressLabel,
        },
        update: {
          pickupType: pickup.pickupType,
          meetingPointId: pickup.meetingPointId,
          latitude: pickup.latitude,
          longitude: pickup.longitude,
          addressLabel: dto.addressLabel,
        },
      });
      const next = await tx.schoolStudent.findFirstOrThrow({
        where: { id },
        include: studentInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.STUDENT_PICKUP_CHANGED,
          entityType: ENTITY.SCHOOL_STUDENT,
          entityId: id,
          before: mapStudentDetail(current).pickup,
          after: mapStudentDetail(next).pickup,
        },
        tx,
      );
      return next;
    });
    return {
      ...mapStudentDetail(updated),
      routeStopsStale: (updated.routeAssignments?.length ?? 0) > 0,
    };
  }

  async listTrips(institutionId: string, id: string, query: PaginationDto) {
    await this.findOwned(institutionId, id);
    const where = { studentId: id, trip: { institutionId } };
    const total = await this.prisma.tripStudent.count({ where });
    const rows = await this.prisma.tripStudent.findMany({
      where,
      include: { trip: true },
      orderBy: { createdAt: 'desc' },
      skip: paginationOffset(query.page, query.limit),
      take: query.limit,
    });
    return {
      data: rows.map(mapStudentTrip),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async boardingHistory(institutionId: string, id: string) {
    await this.findOwned(institutionId, id);
    const rows = await this.prisma.tripStudent.findMany({
      where: {
        studentId: id,
        trip: { institutionId },
        OR: [
          { boardedAt: { not: null } },
          { droppedOffAt: { not: null } },
          { notBoardedAt: { not: null } },
        ],
      },
      include: { trip: true },
    });
    return rows
      .map((row) => ({
        ...mapStudentTrip(row),
        occurredAt: boardingTimestamp(row),
      }))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  private async findOwned(institutionId: string, id: string) {
    const student = await this.prisma.schoolStudent.findFirst({
      where: { id, institutionId, archivedAt: null },
      include: studentInclude,
    });
    if (!student) {
      throw new AppException(
        'STUDENT_NOT_FOUND',
        'Student not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return student;
  }

  private buildWhere(
    institutionId: string,
    query: ListStudentsQueryDto,
  ): Prisma.SchoolStudentWhereInput {
    const where: Prisma.SchoolStudentWhereInput = {
      institutionId,
      archivedAt: null,
    };
    if (query.branchId) {
      where.branchId = query.branchId;
    }
    if (query.grade) {
      where.grade = query.grade;
    }
    if (query.section) {
      where.section = query.section;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.pickupType) {
      where.pickupConfig = { pickupType: query.pickupType };
    }
    if (query.routeId) {
      where.routeAssignments = {
        some: { isActive: true, routeId: query.routeId },
      };
    }
    if (query.withoutRoute) {
      where.routeAssignments = {
        none: {
          isActive: true,
          route: { status: RouteStatus.ACTIVE, archivedAt: null },
        },
      };
    }
    if (query.search) {
      const search = query.search.trim();
      where.AND = [
        {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { grade: { contains: search, mode: 'insensitive' } },
            { section: { contains: search, mode: 'insensitive' } },
            {
              guardianUser: {
                OR: [
                  { fullName: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search } },
                ],
              },
            },
          ],
        },
      ];
    }
    return where;
  }
}
