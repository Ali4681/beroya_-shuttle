import {
  Institution,
  InstitutionBranding,
  ParentArrivalPreference,
  SchoolStudent,
  ShuttleRoute,
  ShuttleTrip,
  ShuttleUser,
  ShuttleVehicle,
  StopType,
  TripDirection,
  TripStop,
  TripStudent,
  UniversityStudentProfile,
} from '../../generated/prisma/client';
import { mapBranding, mapStudent } from '../auth/auth.mapper';
import { boardingTimestamp, mapPickup } from '../institution/people.mapper';
import { mapLiveTrip } from '../tracking/tracking.mapper';

export type ParentStudentHomeExtras = {
  activeTripId?: string | null;
  lastDroppedOffAt?: Date | null;
};

export function mapPassengerStudent(
  student: SchoolStudent & {
    institution?: Pick<Institution, 'name' | 'displayName'> | null;
    pickupConfig?: Parameters<typeof mapPickup>[0];
    routeAssignments?: Array<{
      isActive: boolean;
      route: Pick<ShuttleRoute, 'id' | 'name' | 'status'>;
    }>;
    arrivalPreferences?: ParentArrivalPreference[];
  },
  extras: ParentStudentHomeExtras = {},
) {
  const assignment = student.routeAssignments?.find((row) => row.isActive);
  const preference = student.arrivalPreferences?.[0];
  const institutionName =
    student.institution?.displayName?.trim() ||
    student.institution?.name ||
    '';
  return {
    ...mapStudent(student),
    institutionName,
    activeTripId: extras.activeTripId ?? null,
    lastDroppedOffAt: extras.lastDroppedOffAt ?? null,
    pickup: mapPickup(student.pickupConfig ?? null),
    currentRoute: assignment
      ? {
          id: assignment.route.id,
          name: assignment.route.name,
          status: assignment.route.status,
        }
      : null,
    arrivalPreference: preference
      ? {
          minutesBefore: preference.minutesBefore,
          soundEnabled: preference.soundEnabled,
        }
      : null,
  };
}

export function mapPassengerMe(
  user: ShuttleUser,
  branding: InstitutionBranding | null,
  extra: Record<string, unknown> = {},
) {
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      institutionId: user.institutionId,
      branchId: user.branchId,
    },
    branding: mapBranding(branding),
    ...extra,
  };
}

export function mapUniversityMe(
  user: ShuttleUser,
  profile: UniversityStudentProfile,
  branding: InstitutionBranding | null,
  institution: Pick<
    Institution,
    'id' | 'name' | 'displayName' | 'city' | 'address'
  >,
  extra: Record<string, unknown> = {},
) {
  const displayName = institution.displayName?.trim() || institution.name;
  const supportPhone = branding?.supportPhone?.trim() || null;
  return mapPassengerMe(user, branding, {
    // Override user block so Account always sees photo_url (null until upload exists)
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      institutionId: user.institutionId,
      branchId: user.branchId,
      photoUrl: null,
    },
    institution: {
      id: institution.id,
      name: institution.name,
      displayName,
      city: institution.city?.trim() || null,
      address: institution.address?.trim() || null,
      supportPhone,
    },
    profile: {
      id: profile.id,
      studentNumber: profile.studentNumber,
      faculty: profile.faculty,
      branchId: profile.branchId,
      status: profile.status,
    },
    ...extra,
  });
}

/** Minutes until next stop ETA (0 if past; null if no ETA). */
export function universityEtaMinutes(
  etaAt: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (etaAt == null) {
    return null;
  }
  const at = typeof etaAt === 'string' ? new Date(etaAt) : etaAt;
  if (Number.isNaN(at.getTime())) {
    return null;
  }
  return Math.max(0, Math.round((at.getTime() - now.getTime()) / 60_000));
}

/** Flutter maps filter bands: low <0.45, medium <0.75, high ≥0.75 */
export function universityCrowdBand(
  boardedCount: number,
  capacity: number | null | undefined,
): 'low' | 'medium' | 'high' | null {
  if (capacity == null || capacity <= 0) {
    return null;
  }
  const ratio = boardedCount / capacity;
  if (ratio < 0.45) {
    return 'low';
  }
  if (ratio < 0.75) {
    return 'medium';
  }
  return 'high';
}

export function matchesUniversityEtaFilter(
  etaMinutes: number | null,
  opts: { maxEtaMinutes?: number; minEtaMinutes?: number },
): boolean {
  if (opts.maxEtaMinutes == null && opts.minEtaMinutes == null) {
    return true;
  }
  if (etaMinutes == null) {
    return false;
  }
  if (opts.maxEtaMinutes != null && etaMinutes > opts.maxEtaMinutes) {
    return false;
  }
  if (opts.minEtaMinutes != null && etaMinutes < opts.minEtaMinutes) {
    return false;
  }
  return true;
}

export function matchesUniversityCrowdFilter(
  boardedCount: number,
  capacity: number | null | undefined,
  crowd: 'low' | 'medium' | 'high',
): boolean {
  return universityCrowdBand(boardedCount, capacity) === crowd;
}

export function nearestStopDistanceMeters(
  user: { lat: number; lng: number },
  stops: Array<{ latitude: number; longitude: number }> | undefined,
  distanceFn: (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ) => number,
): number | null {
  if (!stops?.length) {
    return null;
  }
  let best: number | null = null;
  for (const stop of stops) {
    const meters = distanceFn(user, {
      lat: stop.latitude,
      lng: stop.longitude,
    });
    if (best == null || meters < best) {
      best = meters;
    }
  }
  return best == null ? null : Math.round(best);
}

export function universityDestinationLabel(
  trip: Pick<ShuttleTrip, 'direction' | 'originLabel'> & {
    stops?: Array<Pick<TripStop, 'sequence' | 'label' | 'stopType'>>;
  },
  institutionName: string,
): string {
  const stops = [...(trip.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  if (trip.direction === TripDirection.OUTBOUND) {
    const institutionStop = stops.find(
      (stop) => stop.stopType === StopType.INSTITUTION,
    );
    return (
      institutionStop?.label?.trim() ||
      institutionName ||
      trip.originLabel?.trim() ||
      ''
    );
  }
  const lastAway = [...stops]
    .reverse()
    .find((stop) => stop.stopType !== StopType.INSTITUTION);
  return (
    lastAway?.label?.trim() ||
    stops[stops.length - 1]?.label?.trim() ||
    trip.originLabel?.trim() ||
    institutionName ||
    ''
  );
}

/** Total trip duration in minutes for university detail cards (never invents plate-as-label). */
export function universityDurationMinutes(
  trip: Pick<
    ShuttleTrip,
    'startedAt' | 'completedAt' | 'etaToFinishAt' | 'serviceDate' | 'scheduledDepartureTime'
  > & {
    stops?: Array<Pick<TripStop, 'sequence' | 'plannedArrivalAt' | 'etaAt'>>;
  },
): number | null {
  if (trip.startedAt && trip.completedAt) {
    const ms = trip.completedAt.getTime() - trip.startedAt.getTime();
    if (ms >= 0) {
      return Math.round(ms / 60_000);
    }
  }

  if (trip.startedAt && trip.etaToFinishAt) {
    const ms = trip.etaToFinishAt.getTime() - trip.startedAt.getTime();
    if (ms >= 0) {
      return Math.round(ms / 60_000);
    }
  }

  const stops = [...(trip.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  const plannedTimes = stops
    .map((stop) => stop.plannedArrivalAt ?? stop.etaAt)
    .filter((at): at is Date => at != null);
  if (plannedTimes.length >= 2) {
    const first = plannedTimes[0]!.getTime();
    const last = plannedTimes[plannedTimes.length - 1]!.getTime();
    if (last >= first) {
      return Math.round((last - first) / 60_000);
    }
  }

  const lastPlanned = [...stops]
    .reverse()
    .find((stop) => stop.plannedArrivalAt)?.plannedArrivalAt;
  if (lastPlanned && trip.serviceDate && trip.scheduledDepartureTime) {
    const [hh, mm] = trip.scheduledDepartureTime.split(':').map(Number);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      const start = new Date(trip.serviceDate);
      start.setUTCHours(hh!, mm!, 0, 0);
      const ms = lastPlanned.getTime() - start.getTime();
      if (ms >= 0) {
        return Math.round(ms / 60_000);
      }
    }
  }

  return null;
}

export function mapUniversityTripCard(
  input: Parameters<typeof mapLiveTrip>[0] & {
    studentStatus?: string | null;
    studentStopId?: string | null;
    supportPhone?: string | null;
    institutionName: string;
    boardedCount?: number;
    vehicle?: Pick<
      ShuttleVehicle,
      'id' | 'plateNumber' | 'vehicleType' | 'capacity'
    > | null;
    attendant?: {
      id: string;
      fullName: string;
      phone: string;
    } | null;
    nearestStopDistanceMeters?: number | null;
  },
) {
  const live = mapPassengerLive(input);
  const capacity = input.vehicle?.capacity ?? null;
  const plate = input.vehicle?.plateNumber ?? null;
  // Type/label must stay independent from plate (Flutter shows both on detail card)
  const vehicleType = input.vehicle?.vehicleType?.trim() || null;
  const durationMinutes = universityDurationMinutes(input.trip);
  const stops = (live.stops ?? []).map((stop) => ({
    id: stop.id,
    sequence: stop.sequence,
    label: stop.label?.trim() || `Stop ${stop.sequence}`,
    latitude: stop.latitude,
    longitude: stop.longitude,
    stopType: stop.stopType,
    status: stop.status,
    etaAt: stop.etaAt,
    arrivedAt: stop.arrivedAt,
  }));
  const nextStop = stops.find((stop) => !stop.arrivedAt) ?? null;
  const etaSource = nextStop?.etaAt ?? input.trip.etaToNextStopAt ?? null;
  return {
    ...live,
    scheduledDepartureTime: input.trip.scheduledDepartureTime,
    originLabel: input.trip.originLabel?.trim() || '',
    destinationLabel: universityDestinationLabel(
      input.trip,
      input.institutionName,
    ),
    institutionName: input.institutionName,
    boardedCount: input.boardedCount ?? 0,
    capacity,
    durationMinutes,
    estimatedDurationMinutes: durationMinutes,
    etaMinutes: universityEtaMinutes(etaSource),
    nearestStopDistanceMeters: input.nearestStopDistanceMeters ?? null,
    vehicle: input.vehicle
      ? {
          id: input.vehicle.id,
          label: vehicleType,
          type: vehicleType,
          plate,
          capacity,
        }
      : null,
    attendant: input.attendant
      ? {
          id: input.attendant.id,
          name: input.attendant.fullName,
          phone: input.attendant.phone,
        }
      : null,
    // Prefer live Redis / last GPS; Flutter enables Track when lat/lng present on active trips
    location: live.location,
    stops,
    nextStop: nextStop
      ? {
          id: nextStop.id,
          sequence: nextStop.sequence,
          label: nextStop.label,
          etaAt: nextStop.etaAt,
        }
      : null,
  };
}

export function mapPublicRoute(
  route: ShuttleRoute & {
    schedules?: Array<{
      id: string;
      direction: string;
      departureTime: string;
      daysOfWeek: number[];
      isActive: boolean;
    }>;
    _count?: { schedules?: number; stops?: number };
  },
) {
  return {
    id: route.id,
    name: route.name,
    code: route.code,
    status: route.status,
    branchId: route.branchId,
    originLabel: route.originLabel,
    originLat: route.originLat,
    originLng: route.originLng,
    scheduleCount: route._count?.schedules ?? route.schedules?.length,
    stopCount: route._count?.stops,
    schedules: route.schedules?.map((schedule) => ({
      id: schedule.id,
      direction: schedule.direction,
      departureTime: schedule.departureTime,
      daysOfWeek: schedule.daysOfWeek,
      isActive: schedule.isActive,
    })),
  };
}

export function mapPassengerTripRow(
  row: TripStudent & { trip: ShuttleTrip & { route?: Pick<ShuttleRoute, 'id' | 'name'> | null } },
) {
  return {
    id: row.id,
    status: row.status,
    boardedAt: row.boardedAt,
    droppedOffAt: row.droppedOffAt,
    notBoardedAt: row.notBoardedAt,
    occurredAt: boardingTimestamp(row),
    trip: {
      id: row.trip.id,
      serviceDate: row.trip.serviceDate,
      direction: row.trip.direction,
      status: row.trip.status,
      scheduledDepartureTime: row.trip.scheduledDepartureTime,
      route: row.trip.route
        ? { id: row.trip.route.id, name: row.trip.route.name }
        : { id: row.trip.routeId },
    },
  };
}

export function mapPassengerLive(input: Parameters<typeof mapLiveTrip>[0] & {
  studentStatus?: string | null;
  studentStopId?: string | null;
  supportPhone?: string | null;
}) {
  return {
    ...mapLiveTrip(input),
    studentStatus: input.studentStatus ?? null,
    studentStopId: input.studentStopId ?? null,
    supportPhone: input.supportPhone ?? null,
  };
}
