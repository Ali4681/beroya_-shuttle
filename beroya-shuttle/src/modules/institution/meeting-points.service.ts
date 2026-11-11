import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  ResourceStatus,
  StudentStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../admin/admin.constants';
import { AuditService } from '../shared/audit/audit.service';
import { CreateMeetingPointDto } from './dto/create-meeting-point.dto';
import { UpdateMeetingPointDto } from './dto/update-meeting-point.dto';
import { PeopleUsersService } from './people-users.service';
import { mapMeetingPoint } from './people.mapper';

@Injectable()
export class MeetingPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly people: PeopleUsersService,
  ) {}

  async list(institutionId: string) {
    const rows = await this.prisma.meetingPoint.findMany({
      where: { institutionId, archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(mapMeetingPoint);
  }

  async create(
    actorUserId: string,
    institutionId: string,
    dto: CreateMeetingPointDto,
  ) {
    if (dto.branchId) {
      await this.people.requireBranch(institutionId, dto.branchId);
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const point = await tx.meetingPoint.create({
        data: {
          institutionId,
          name: dto.name,
          latitude: dto.latitude,
          longitude: dto.longitude,
          addressLabel: dto.addressLabel,
          branchId: dto.branchId,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.MEETING_POINT_CREATED,
          entityType: ENTITY.MEETING_POINT,
          entityId: point.id,
          after: mapMeetingPoint(point),
        },
        tx,
      );
      return point;
    });
    return mapMeetingPoint(created);
  }

  async getById(institutionId: string, id: string) {
    return mapMeetingPoint(await this.findOwned(institutionId, id));
  }

  async update(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: UpdateMeetingPointDto,
  ) {
    const current = await this.findOwned(institutionId, id);
    if (dto.branchId) {
      await this.people.requireBranch(institutionId, dto.branchId);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.meetingPoint.update({
        where: { id },
        data: {
          name: dto.name,
          latitude: dto.latitude,
          longitude: dto.longitude,
          addressLabel: dto.addressLabel,
          branchId: dto.branchId,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.MEETING_POINT_UPDATED,
          entityType: ENTITY.MEETING_POINT,
          entityId: id,
          before: mapMeetingPoint(current),
          after: mapMeetingPoint(next),
        },
        tx,
      );
      return next;
    });
    return mapMeetingPoint(updated);
  }

  async updateStatus(
    actorUserId: string,
    institutionId: string,
    id: string,
    status: ResourceStatus,
  ) {
    const current = await this.findOwned(institutionId, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.meetingPoint.update({
        where: { id },
        data: { status },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.MEETING_POINT_STATUS_CHANGED,
          entityType: ENTITY.MEETING_POINT,
          entityId: id,
          before: { status: current.status },
          after: { status: next.status },
        },
        tx,
      );
      return next;
    });
    return mapMeetingPoint(updated);
  }

  async remove(actorUserId: string, institutionId: string, id: string) {
    const current = await this.findOwned(institutionId, id);
    const linked = await this.prisma.studentPickupConfig.count({
      where: {
        meetingPointId: id,
        student: {
          institutionId,
          archivedAt: null,
          status: StudentStatus.ACTIVE,
        },
      },
    });
    if (linked > 0) {
      throw new AppException(
        'MEETING_POINT_IN_USE',
        'Meeting point is still linked to active students',
        HttpStatus.CONFLICT,
        { students: linked },
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.meetingPoint.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.MEETING_POINT_DELETED,
          entityType: ENTITY.MEETING_POINT,
          entityId: id,
          before: mapMeetingPoint(current),
        },
        tx,
      );
    });
    return { success: true };
  }

  private async findOwned(institutionId: string, id: string) {
    const point = await this.prisma.meetingPoint.findFirst({
      where: { id, institutionId, archivedAt: null },
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
}
