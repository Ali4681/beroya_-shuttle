import {
  AttendantProfile,
  DriverProfile,
  InstitutionBranch,
  ShuttleRoute,
  ShuttleTrip,
  ShuttleUser,
  ShuttleVehicle,
  TripIncident,
} from '../../generated/prisma/client';
import { mapUser } from '../auth/auth.mapper';

export function mapIncident(
  row: TripIncident & {
    trip?: ShuttleTrip & {
      route?: Pick<ShuttleRoute, 'id' | 'name'> | null;
      branch?: Pick<InstitutionBranch, 'id' | 'name'> | null;
      driver?: (DriverProfile & { user: ShuttleUser }) | null;
      vehicle?: ShuttleVehicle | null;
      attendant?: (AttendantProfile & { user: ShuttleUser }) | null;
    };
    reportedByUser?: Pick<ShuttleUser, 'id' | 'fullName'> | null;
    resolvedByUser?: Pick<ShuttleUser, 'id' | 'fullName'> | null;
  },
) {
  return {
    id: row.id,
    tripId: row.tripId,
    type: row.type,
    status: row.status,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    resolvedAt: row.resolvedAt,
    resolutionNotes: row.resolutionNotes,
    createdAt: row.createdAt,
    reportedBy: row.reportedByUser
      ? { id: row.reportedByUser.id, fullName: row.reportedByUser.fullName }
      : null,
    resolvedBy: row.resolvedByUser
      ? { id: row.resolvedByUser.id, fullName: row.resolvedByUser.fullName }
      : null,
    trip: row.trip
      ? {
          id: row.trip.id,
          status: row.trip.status,
          route: row.trip.route
            ? { id: row.trip.route.id, name: row.trip.route.name }
            : null,
          branch: row.trip.branch
            ? { id: row.trip.branch.id, name: row.trip.branch.name }
            : null,
          driver: row.trip.driver
            ? { id: row.trip.driver.id, user: mapUser(row.trip.driver.user) }
            : null,
          vehicle: row.trip.vehicle
            ? {
                id: row.trip.vehicle.id,
                plateNumber: row.trip.vehicle.plateNumber,
              }
            : null,
          attendant: row.trip.attendant
            ? {
                id: row.trip.attendant.id,
                user: mapUser(row.trip.attendant.user),
              }
            : null,
        }
      : null,
  };
}
