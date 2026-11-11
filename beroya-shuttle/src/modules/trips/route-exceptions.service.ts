import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { TripStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../admin/admin.constants';
import { AuditService } from '../shared/audit/audit.service';
import { CreateRouteExceptionDto } from './dto/create-route-exception.dto';
import { TripGenerationService } from './trip-generation.service';
import { parseServiceDate } from './trip.rules';

@Injectable()
export class RouteExceptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly generation: TripGenerationService,
  ) {}

  async list(institutionId: string, studentId: string) {
    await this.requireStudent(institutionId, studentId);
    const rows = await this.prisma.studentRouteException.findMany({
      where: { studentId },
      include: {
        overrideRoute: { select: { id: true, name: true, status: true } },
      },
      orderBy: { date: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      overrideRouteId: row.overrideRouteId,
      overrideRoute: row.overrideRoute,
      direction: row.direction,
      date: row.date,
      reason: row.reason,
      createdAt: row.createdAt,
    }));
  }

  async create(
    actorUserId: string,
    institutionId: string,
    studentId: string,
    dto: CreateRouteExceptionDto,
  ) {
    const student = await this.requireStudent(institutionId, studentId);
    const date = parseServiceDate(dto.date);
    if (dto.overrideRouteId === student.routeAssignments[0]?.routeId) {
      throw new AppException(
        'EXCEPTION_SAME_ROUTE',
        'Override route must be different from the student primary route',
        HttpStatus.BAD_REQUEST,
      );
    }
    const override = await this.prisma.shuttleRoute.findFirst({
      where: { id: dto.overrideRouteId, institutionId, archivedAt: null },
    });
    if (!override) {
      throw new AppException(
        'ROUTE_NOT_FOUND',
        'Override route not found',
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.studentRouteException.create({
          data: {
            studentId,
            overrideRouteId: dto.overrideRouteId,
            direction: dto.direction,
            date,
            reason: dto.reason,
            createdByUserId: actorUserId,
          },
          include: {
            overrideRoute: { select: { id: true, name: true, status: true } },
          },
        });
        await this.generation.applyExceptionsForStudent(
          institutionId,
          studentId,
          date,
          tx,
        );
        await this.audit.record(
          {
            actorUserId,
            institutionId,
            action: AUDIT.ROUTE_EXCEPTION_CREATED,
            entityType: ENTITY.STUDENT_ROUTE_EXCEPTION,
            entityId: row.id,
            after: {
              studentId,
              overrideRouteId: dto.overrideRouteId,
              date: dto.date,
              direction: dto.direction,
            },
          },
          tx,
        );
        return row;
      });
      return {
        id: created.id,
        studentId: created.studentId,
        overrideRouteId: created.overrideRouteId,
        overrideRoute: created.overrideRoute,
        direction: created.direction,
        date: created.date,
        reason: created.reason,
        createdAt: created.createdAt,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new AppException(
          'EXCEPTION_ALREADY_EXISTS',
          'An exception already exists for this student, date, and direction',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async remove(
    actorUserId: string,
    institutionId: string,
    studentId: string,
    exceptionId: string,
  ) {
    await this.requireStudent(institutionId, studentId);
    const current = await this.prisma.studentRouteException.findFirst({
      where: { id: exceptionId, studentId },
    });
    if (!current) {
      throw new AppException(
        'EXCEPTION_NOT_FOUND',
        'Route exception not found',
        HttpStatus.NOT_FOUND,
      );
    }
    const started = await this.prisma.shuttleTrip.count({
      where: {
        institutionId,
        serviceDate: current.date,
        ...(current.direction ? { direction: current.direction } : {}),
        status: { in: [TripStatus.IN_PROGRESS, TripStatus.COMPLETED] },
        students: { some: { studentId } },
      },
    });
    if (started > 0) {
      throw new AppException(
        'EXCEPTION_TRIP_STARTED',
        'Cannot delete an exception after the related trip has started',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studentRouteException.delete({ where: { id: exceptionId } });
      await this.generation.restoreStudentToPrimary(
        institutionId,
        studentId,
        current.date,
        current.direction,
        tx,
      );
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ROUTE_EXCEPTION_DELETED,
          entityType: ENTITY.STUDENT_ROUTE_EXCEPTION,
          entityId: exceptionId,
          before: {
            studentId,
            overrideRouteId: current.overrideRouteId,
            date: current.date,
          },
        },
        tx,
      );
    });
    return { success: true };
  }

  private async requireStudent(institutionId: string, studentId: string) {
    const student = await this.prisma.schoolStudent.findFirst({
      where: { id: studentId, institutionId, archivedAt: null },
      include: {
        routeAssignments: {
          where: { isActive: true },
          select: { routeId: true },
        },
      },
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
}
