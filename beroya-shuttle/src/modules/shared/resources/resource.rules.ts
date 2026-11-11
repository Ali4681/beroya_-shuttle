import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { OperationModel, OwnerType } from '../../../generated/prisma/client';

export function canSeeBeroyaResources(operationModel: OperationModel): boolean {
  return operationModel === OperationModel.BEROYA_OPERATED;
}

/** Beroya fleet resources (owned by Beroya or by a Beroya-linked driver). */
export function isBeroyaFleetOwner(ownerType: OwnerType): boolean {
  return ownerType === OwnerType.BEROYA || ownerType === OwnerType.DRIVER;
}

export function assertInstitutionCanMutate(ownerType: OwnerType): void {
  if (isBeroyaFleetOwner(ownerType)) {
    throw new AppException(
      'RESOURCE_OWNED_BY_BEROYA',
      'This resource is owned by Beroya and cannot be edited by the institution',
      HttpStatus.FORBIDDEN,
    );
  }
}

export function isAssigned(routeCount: number): boolean {
  return routeCount > 0;
}

export function buildResourceStats(
  rows: Array<{
    status: string;
    assigned: boolean;
  }>,
) {
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === 'ACTIVE').length,
    suspended: rows.filter((row) => row.status === 'SUSPENDED').length,
    underMaintenance: rows.filter((row) => row.status === 'UNDER_MAINTENANCE')
      .length,
    assigned: rows.filter((row) => row.assigned).length,
    unassigned: rows.filter((row) => !row.assigned).length,
  };
}
