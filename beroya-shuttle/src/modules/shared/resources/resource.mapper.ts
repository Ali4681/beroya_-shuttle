import {
  AttendantProfile,
  DriverProfile,
  ShuttleRoute,
  ShuttleTrip,
  ShuttleUser,
  ShuttleVehicle,
} from '../../../generated/prisma/client';
import { mapUser } from '../../auth/auth.mapper';

type RouteRef = Pick<ShuttleRoute, 'id' | 'name' | 'status'>;

export function mapDriver(
  driver: DriverProfile & {
    user: ShuttleUser;
    defaultForRoutes?: RouteRef[];
    _count?: { defaultForRoutes?: number };
    primaryVehicle?: Pick<
      ShuttleVehicle,
      | 'id'
      | 'plateNumber'
      | 'vehicleType'
      | 'capacity'
      | 'licenseExpiry'
      | 'insuranceExpiry'
      | 'ownerType'
      | 'status'
    > | null;
  },
) {
  const assigned =
    (driver._count?.defaultForRoutes ?? driver.defaultForRoutes?.length ?? 0) >
    0;
  return {
    id: driver.id,
    userId: driver.userId,
    institutionId: driver.institutionId,
    ownerType: driver.ownerType,
    nationalId: driver.nationalId,
    licenseNumber: driver.licenseNumber,
    licenseExpiry: driver.licenseExpiry,
    primaryVehicleId: driver.primaryVehicleId,
    primaryVehicle: driver.primaryVehicle
      ? {
          id: driver.primaryVehicle.id,
          plateNumber: driver.primaryVehicle.plateNumber,
          vehicleType: driver.primaryVehicle.vehicleType,
          capacity: driver.primaryVehicle.capacity,
          licenseExpiry: driver.primaryVehicle.licenseExpiry,
          insuranceExpiry: driver.primaryVehicle.insuranceExpiry,
          ownerType: driver.primaryVehicle.ownerType,
          status: driver.primaryVehicle.status,
        }
      : null,
    dailyTripsLimit: driver.dailyTripsLimit,
    status: driver.status,
    assigned,
    assignedRoutes: (driver.defaultForRoutes ?? []).map((route) => ({
      id: route.id,
      name: route.name,
      status: route.status,
      needsReassignment: driver.status !== 'ACTIVE',
    })),
    user: mapUser(driver.user),
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  };
}

export function mapVehicle(
  vehicle: ShuttleVehicle & {
    defaultForRoutes?: RouteRef[];
    _count?: { defaultForRoutes?: number };
    ownerDriver?:
      | (DriverProfile & { user: ShuttleUser })
      | null;
  },
) {
  const assigned =
    (vehicle._count?.defaultForRoutes ?? vehicle.defaultForRoutes?.length ?? 0) >
    0;
  return {
    id: vehicle.id,
    institutionId: vehicle.institutionId,
    ownerType: vehicle.ownerType,
    ownerDriverId: vehicle.ownerDriverId,
    ownerDriver: vehicle.ownerDriver
      ? {
          id: vehicle.ownerDriver.id,
          fullName: vehicle.ownerDriver.user.fullName,
          phone: vehicle.ownerDriver.user.phone,
          email: vehicle.ownerDriver.user.email,
          status: vehicle.ownerDriver.status,
        }
      : null,
    plateNumber: vehicle.plateNumber,
    vehicleType: vehicle.vehicleType,
    capacity: vehicle.capacity,
    licenseExpiry: vehicle.licenseExpiry,
    insuranceExpiry: vehicle.insuranceExpiry,
    status: vehicle.status,
    assigned,
    assignedRoutes: (vehicle.defaultForRoutes ?? []).map((route) => ({
      id: route.id,
      name: route.name,
      status: route.status,
      needsReassignment: vehicle.status !== 'ACTIVE',
    })),
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}

export function mapAttendant(
  attendant: AttendantProfile & {
    user: ShuttleUser;
    defaultForRoute?: Pick<ShuttleRoute, 'id' | 'name' | 'status'> | null;
  },
) {
  return {
    id: attendant.id,
    userId: attendant.userId,
    institutionId: attendant.institutionId,
    nationalId: attendant.nationalId,
    status: attendant.status,
    assigned: Boolean(attendant.defaultForRoute),
    assignedRoute: attendant.defaultForRoute
      ? {
          id: attendant.defaultForRoute.id,
          name: attendant.defaultForRoute.name,
          status: attendant.defaultForRoute.status,
          needsReassignment: attendant.status !== 'ACTIVE',
        }
      : null,
    user: mapUser(attendant.user),
    createdAt: attendant.createdAt,
    updatedAt: attendant.updatedAt,
  };
}

export function mapResourceTrip(trip: ShuttleTrip) {
  return {
    id: trip.id,
    institutionId: trip.institutionId,
    branchId: trip.branchId,
    routeId: trip.routeId,
    direction: trip.direction,
    status: trip.status,
    serviceDate: trip.serviceDate,
    scheduledDepartureTime: trip.scheduledDepartureTime,
  };
}
