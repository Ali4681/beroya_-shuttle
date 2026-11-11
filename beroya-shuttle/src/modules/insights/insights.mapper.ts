import {
  DriverProfile,
  Institution,
  InstitutionSubscription,
  SchoolStudent,
  ShuttleAuditLog,
  ShuttleRoute,
  ShuttleUser,
  ShuttleVehicle,
} from '../../generated/prisma/client';
import { mapInstitution, mapStudent, mapUser } from '../auth/auth.mapper';
import { mapSubscription } from '../admin/admin.mapper';

export function mapAuditLog(
  row: ShuttleAuditLog & {
    actorUser?: Pick<ShuttleUser, 'id' | 'fullName' | 'role'> | null;
  },
) {
  return {
    id: row.id,
    institutionId: row.institutionId,
    actorUserId: row.actorUserId,
    actor: row.actorUser
      ? {
          id: row.actorUser.id,
          fullName: row.actorUser.fullName,
          role: row.actorUser.role,
        }
      : null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: row.before,
    after: row.after,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  };
}

export function mapSearchStudent(student: SchoolStudent) {
  return mapStudent(student);
}

export function mapSearchParent(user: ShuttleUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    branchId: user.branchId,
    status: user.status,
  };
}

export function mapSearchRoute(route: ShuttleRoute) {
  return {
    id: route.id,
    name: route.name,
    code: route.code,
    branchId: route.branchId,
    status: route.status,
  };
}

export function mapSearchDriver(
  driver: DriverProfile & { user: ShuttleUser },
) {
  return {
    id: driver.id,
    fullName: driver.user.fullName,
    phone: driver.user.phone,
    status: driver.status,
    ownerType: driver.ownerType,
    institutionId: driver.institutionId,
  };
}

export function mapSearchVehicle(vehicle: ShuttleVehicle) {
  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    vehicleType: vehicle.vehicleType,
    status: vehicle.status,
    ownerType: vehicle.ownerType,
    institutionId: vehicle.institutionId,
  };
}

export function mapSearchInstitution(institution: Institution) {
  return mapInstitution(institution);
}

export function mapRecentInstitution(
  institution: Institution & {
    primaryAdmin?: ShuttleUser | null;
    subscriptions?: InstitutionSubscription[];
  },
) {
  return {
    ...mapInstitution(institution),
    createdAt: institution.createdAt,
    contactPhone: institution.contactPhone,
  };
}

export function mapExpiringSubscription(
  subscription: InstitutionSubscription & { institution: Institution },
) {
  return {
    ...mapSubscription(subscription),
    institution: mapInstitution(subscription.institution),
  };
}
