import { Injectable } from '@nestjs/common';
import { ShuttleRole } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  mapSearchDriver,
  mapSearchInstitution,
  mapSearchParent,
  mapSearchRoute,
  mapSearchStudent,
  mapSearchVehicle,
} from './insights.mapper';
import {
  emptyAdminSearch,
  emptyInstitutionSearch,
  sanitizeSearchTerm,
  searchLimit,
} from './insights.rules';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async institutionSearch(
    institutionId: string,
    q?: string,
    branchId?: string,
    limit?: number,
  ) {
    const term = sanitizeSearchTerm(q);
    const take = searchLimit(limit);
    if (!term) {
      return emptyInstitutionSearch();
    }

    const [students, parents, routes, drivers, vehicles] = await Promise.all([
      this.prisma.schoolStudent.findMany({
        where: {
          institutionId,
          archivedAt: null,
          ...(branchId ? { branchId } : {}),
          fullName: { contains: term, mode: 'insensitive' },
        },
        take,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.shuttleUser.findMany({
        where: {
          institutionId,
          role: ShuttleRole.PARENT,
          archivedAt: null,
          ...(branchId ? { branchId } : {}),
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
          ],
        },
        take,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.shuttleRoute.findMany({
        where: {
          institutionId,
          archivedAt: null,
          ...(branchId ? { branchId } : {}),
          name: { contains: term, mode: 'insensitive' },
        },
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.driverProfile.findMany({
        where: {
          institutionId,
          archivedAt: null,
          user: {
            OR: [
              { fullName: { contains: term, mode: 'insensitive' } },
              { phone: { contains: term, mode: 'insensitive' } },
            ],
          },
        },
        include: { user: true },
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shuttleVehicle.findMany({
        where: {
          institutionId,
          archivedAt: null,
          plateNumber: { contains: term, mode: 'insensitive' },
        },
        take,
        orderBy: { plateNumber: 'asc' },
      }),
    ]);

    return {
      students: students.map(mapSearchStudent),
      parents: parents.map(mapSearchParent),
      routes: routes.map(mapSearchRoute),
      drivers: drivers.map(mapSearchDriver),
      vehicles: vehicles.map(mapSearchVehicle),
    };
  }

  async adminSearch(q?: string, limit?: number) {
    const term = sanitizeSearchTerm(q);
    const take = searchLimit(limit);
    if (!term) {
      return emptyAdminSearch();
    }

    const [institutions, drivers, vehicles] = await Promise.all([
      this.prisma.institution.findMany({
        where: {
          archivedAt: null,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { displayName: { contains: term, mode: 'insensitive' } },
          ],
        },
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.driverProfile.findMany({
        where: {
          archivedAt: null,
          user: {
            OR: [
              { fullName: { contains: term, mode: 'insensitive' } },
              { phone: { contains: term, mode: 'insensitive' } },
            ],
          },
        },
        include: { user: true },
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shuttleVehicle.findMany({
        where: {
          archivedAt: null,
          plateNumber: { contains: term, mode: 'insensitive' },
        },
        take,
        orderBy: { plateNumber: 'asc' },
      }),
    ]);

    return {
      institutions: institutions.map(mapSearchInstitution),
      drivers: drivers.map(mapSearchDriver),
      vehicles: vehicles.map(mapSearchVehicle),
    };
  }
}
