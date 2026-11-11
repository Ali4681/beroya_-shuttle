import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { todayInTimezone } from '../../common/utils/timezone';
import {
  RouteStatus,
  StudentStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../admin/admin.constants';
import { mapBranch } from '../auth/auth.mapper';
import { AuditService } from '../shared/audit/audit.service';
import { assertBranchEmpty } from './branch.rules';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateBranchStatusDto } from './dto/update-branch-status.dto';
import { InstitutionService } from './institution.service';

@Injectable()
export class InstitutionBranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly institutions: InstitutionService,
  ) {}

  async list(institutionId: string) {
    await this.institutions.loadInstitution(institutionId);
    const branches = await this.prisma.institutionBranch.findMany({
      where: { institutionId, archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return branches.map(mapBranch);
  }

  async create(actorUserId: string, institutionId: string, dto: CreateBranchDto) {
    await this.institutions.loadInstitution(institutionId);
    await this.assertNameAvailable(institutionId, dto.name);

    const created = await this.prisma.$transaction(async (tx) => {
      const branch = await tx.institutionBranch.create({
        data: {
          institutionId,
          name: dto.name,
          address: dto.address,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.BRANCH_CREATED,
          entityType: ENTITY.INSTITUTION_BRANCH,
          entityId: branch.id,
          after: mapBranch(branch),
        },
        tx,
      );
      return branch;
    });
    return mapBranch(created);
  }

  async getById(institutionId: string, branchId: string) {
    return mapBranch(await this.findOwned(institutionId, branchId));
  }

  async update(
    actorUserId: string,
    institutionId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ) {
    const current = await this.findOwned(institutionId, branchId);
    if (dto.name && dto.name !== current.name) {
      await this.assertNameAvailable(institutionId, dto.name, branchId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institutionBranch.update({
        where: { id: branchId },
        data: {
          name: dto.name,
          address: dto.address,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.BRANCH_UPDATED,
          entityType: ENTITY.INSTITUTION_BRANCH,
          entityId: branchId,
          before: mapBranch(current),
          after: mapBranch(next),
        },
        tx,
      );
      return next;
    });
    return mapBranch(updated);
  }

  async updateStatus(
    actorUserId: string,
    institutionId: string,
    branchId: string,
    dto: UpdateBranchStatusDto,
  ) {
    const current = await this.findOwned(institutionId, branchId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institutionBranch.update({
        where: { id: branchId },
        data: { status: dto.status },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.BRANCH_STATUS_CHANGED,
          entityType: ENTITY.INSTITUTION_BRANCH,
          entityId: branchId,
          before: { status: current.status },
          after: { status: next.status },
        },
        tx,
      );
      return next;
    });
    return mapBranch(updated);
  }

  async remove(actorUserId: string, institutionId: string, branchId: string) {
    const current = await this.findOwned(institutionId, branchId);
    const [students, routes] = await Promise.all([
      this.prisma.schoolStudent.count({
        where: {
          institutionId,
          branchId,
          archivedAt: null,
          status: StudentStatus.ACTIVE,
        },
      }),
      this.prisma.shuttleRoute.count({
        where: {
          institutionId,
          branchId,
          archivedAt: null,
          status: RouteStatus.ACTIVE,
        },
      }),
    ]);
    assertBranchEmpty({ students, routes });

    await this.prisma.$transaction(async (tx) => {
      await tx.institutionBranch.update({
        where: { id: branchId },
        data: { archivedAt: new Date() },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.BRANCH_DELETED,
          entityType: ENTITY.INSTITUTION_BRANCH,
          entityId: branchId,
          before: mapBranch(current),
        },
        tx,
      );
    });

    return { success: true };
  }

  async stats(institutionId: string, branchId: string) {
    await this.findOwned(institutionId, branchId);
    const institution = await this.institutions.loadInstitution(institutionId);
    const timezone = institution.settings?.timezone ?? 'Asia/Damascus';
    const today = todayInTimezone(timezone);

    const [students, routes, tripsToday] = await Promise.all([
      this.prisma.schoolStudent.count({
        where: { institutionId, branchId, archivedAt: null },
      }),
      this.prisma.shuttleRoute.count({
        where: { institutionId, branchId, archivedAt: null },
      }),
      this.prisma.shuttleTrip.count({
        where: { institutionId, branchId, serviceDate: today },
      }),
    ]);

    return {
      branchId,
      timezone,
      serviceDate: today.toISOString().slice(0, 10),
      counts: {
        students,
        routes,
        tripsToday,
      },
    };
  }

  private async findOwned(institutionId: string, branchId: string) {
    const branch = await this.prisma.institutionBranch.findFirst({
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

  private async assertNameAvailable(
    institutionId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.prisma.institutionBranch.findFirst({
      where: {
        institutionId,
        name,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (clash) {
      throw new AppException(
        'BRANCH_NAME_TAKEN',
        'A branch with this name already exists',
        HttpStatus.CONFLICT,
      );
    }
  }
}
