import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { IncidentStatus, TripStatus } from '../../generated/prisma/client';

export function assertCanReportIncident(status: TripStatus): void {
  if (status === TripStatus.COMPLETED) {
    throw new AppException(
      'TRIP_ALREADY_COMPLETED',
      'Cannot report an incident on a completed trip',
      HttpStatus.CONFLICT,
    );
  }
  if (status === TripStatus.CANCELLED) {
    throw new AppException(
      'TRIP_CANCELLED',
      'Cannot report an incident on a cancelled trip',
      HttpStatus.CONFLICT,
    );
  }
  if (status !== TripStatus.IN_PROGRESS) {
    throw new AppException(
      'TRIP_NOT_STARTED',
      'Incidents are accepted after the driver starts the trip',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertIncidentOpen(status: IncidentStatus): void {
  if (status !== IncidentStatus.OPEN) {
    throw new AppException(
      'INCIDENT_ALREADY_RESOLVED',
      'This incident is already resolved',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertIncidentMatchesTrip(
  incidentTripId: string,
  tripId: string,
): void {
  if (incidentTripId !== tripId) {
    throw new AppException(
      'INCIDENT_TRIP_MISMATCH',
      'Incident does not belong to this trip',
      HttpStatus.CONFLICT,
    );
  }
}
