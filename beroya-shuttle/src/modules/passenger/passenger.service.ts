import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { todayInTimezone } from '../../common/utils/timezone';
import {
  Prisma,
  TripStatus,
  TripStudentStatus,
} from '../../generated/prisma/client';
import { haversineMeters } from '../../infra/routing/haversine';
import { RoutingService } from '../../infra/routing/routing.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  mapRoutePolylineFields,
  refreshShuttleRoutePolylines,
  routeNeedsPolylineRefresh,
} from '../institution/route-polyline';
import { parseServiceDate } from '../trips/trip.rules';
import { isGpsStale } from '../tracking/tracking.rules';
import { LiveLocationStore } from '../tracking/live-location.store';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { ArrivalPreferenceDto } from './dto/arrival-preference.dto';
import { DateRangeQueryDto } from './dto/date-range.query';
import { RecordAbsenceDto } from './dto/record-absence.dto';
import { RecordDateAbsenceDto } from './dto/record-date-absence.dto';
import { ParentAbsenceService } from './parent-absence.service';
import { UniversityRoutesQueryDto } from './dto/university-routes.query';
import { UniversityTripsQueryDto } from './dto/university-trips.query';
import {
  mapPassengerLive,
  mapPassengerMe,
  mapPassengerStudent,
  mapPassengerTripRow,
  mapPublicRoute,
  mapUniversityMe,
  mapUniversityTripCard,
  matchesUniversityCrowdFilter,
  matchesUniversityEtaFilter,
  nearestStopDistanceMeters,
  universityEtaMinutes,
} from './passenger.mapper';
import { assertArrivalMinutes } from './passenger.rules';

const universityTripInclude = {
  route: { select: { id: true, name: true } },
  vehicle: {
    select: {
      id: true,
      plateNumber: true,
      vehicleType: true,
      capacity: true,
    },
  },
  attendant: {
    select: {
      id: true,
      user: { select: { id: true, fullName: true, phone: true } },
    },
  },
  stops: true,
  _count: {
    select: {
      students: {
        where: {
          status: {
            in: [TripStudentStatus.BOARDED, TripStudentStatus.DROPPED_OFF],
          },
        },
      },
    },
  },
} satisfies Prisma.ShuttleTripInclude;

type UniversityTripRow = Prisma.ShuttleTripGetPayload<{
  include: typeof universityTripInclude;
}>;

const studentInclude = {
  institution: { select: { name: true, displayName: true } },
  pickupConfig: { include: { meetingPoint: true } },
  routeAssignments: {
    where: { isActive: true },
    include: { route: { select: { id: true, name: true, status: true } } },
  },
  arrivalPreferences: true,
} satisfies Prisma.SchoolStudentInclude;

type ParentStudentRow = Prisma.SchoolStudentGetPayload<{
  include: typeof studentInclude;
}>;

@Injectable()
export class PassengerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveLocationStore,
    private readonly platform: PlatformSettingsService,
    private readonly absences: ParentAbsenceService,
    private readonly routing: RoutingService,
  ) {}

  async parentMe(userId: string) {
    const user = await this.requireParent(userId);
    const students = await this.prisma.schoolStudent.findMany({
      where: { guardianUserId: userId, archivedAt: null },
      include: studentInclude,
      orderBy: { fullName: 'asc' },
    });
    const platform = await this.platform.read();
    return mapPassengerMe(user, user.institution?.branding ?? null, {
      students: await this.mapParentStudents(students),
      tracking: this.platform.trackingFor(platform.apps.parent, platform),
      platform: this.platform.clientOps(platform),
    });
  }

  async parentStudents(userId: string) {
    const students = await this.prisma.schoolStudent.findMany({
      where: { guardianUserId: userId, archivedAt: null },
      include: studentInclude,
      orderBy: { fullName: 'asc' },
    });
    return this.mapParentStudents(students);
  }

  async parentStudent(userId: string, studentId: string) {
    const student = await this.requireChild(userId, studentId);
    const [mapped] = await this.mapParentStudents([student]);
    return mapped;
  }

  async activeTrip(userId: string, studentId: string) {
    const student = await this.requireChild(userId, studentId);
    const timezone = await this.timezone(student.institutionId);
    const today = todayInTimezone(timezone);
    const include = {
      trip: { include: { route: { select: { id: true, name: true } }, stops: true } },
    } as const;
    const row =
      (await this.prisma.tripStudent.findFirst({
        where: {
          studentId,
          trip: { serviceDate: today, status: TripStatus.IN_PROGRESS },
        },
        include,
      })) ??
      (await this.prisma.tripStudent.findFirst({
        where: {
          studentId,
          trip: { serviceDate: today, status: TripStatus.SCHEDULED },
        },
        include,
      }));
    if (!row) {
      return null;
    }
    return this.decorateLive(
      row.trip,
      row.status,
      student.institutionId,
      row.tripStopId,
    );
  }

  async studentTrips(userId: string, studentId: string, query: DateRangeQueryDto) {
    await this.requireChild(userId, studentId);
    const rows = await this.prisma.tripStudent.findMany({
      where: {
        studentId,
        ...(query.from || query.to
          ? {
              trip: {
                serviceDate: {
                  ...(query.from ? { gte: parseServiceDate(query.from) } : {}),
                  ...(query.to ? { lte: parseServiceDate(query.to) } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        trip: { include: { route: { select: { id: true, name: true } } } },
      },
      orderBy: { trip: { serviceDate: 'desc' } },
    });
    return rows.map(mapPassengerTripRow);
  }

  async boardingHistory(userId: string, studentId: string) {
    await this.requireChild(userId, studentId);
    const rows = await this.prisma.tripStudent.findMany({
      where: {
        studentId,
        OR: [
          { boardedAt: { not: null } },
          { droppedOffAt: { not: null } },
          { notBoardedAt: { not: null } },
        ],
      },
      include: {
        trip: { include: { route: { select: { id: true, name: true } } } },
      },
    });
    return rows
      .map(mapPassengerTripRow)
      .sort(
        (left, right) =>
          right.occurredAt.getTime() - left.occurredAt.getTime(),
      );
  }

  async parentLive(userId: string, tripId: string) {
    const user = await this.requireParent(userId);
    const row = await this.prisma.tripStudent.findFirst({
      where: {
        tripId,
        student: { guardianUserId: userId, archivedAt: null },
      },
      include: {
        trip: { include: { route: { select: { id: true, name: true } }, stops: true } },
      },
    });
    if (!row) {
      throw new AppException(
        'TRIP_NOT_FOUND',
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.decorateLive(
      row.trip,
      row.status,
      user.institutionId ?? row.trip.institutionId,
      row.tripStopId,
    );
  }

  async updateArrivalPreference(
    userId: string,
    studentId: string,
    dto: ArrivalPreferenceDto,
  ) {
    await this.requireChild(userId, studentId);
    assertArrivalMinutes(dto.minutesBefore);
    const row = await this.prisma.parentArrivalPreference.upsert({
      where: {
        parentUserId_studentId: { parentUserId: userId, studentId },
      },
      update: {
        minutesBefore: dto.minutesBefore,
        soundEnabled: dto.soundEnabled ?? true,
      },
      create: {
        parentUserId: userId,
        studentId,
        minutesBefore: dto.minutesBefore,
        soundEnabled: dto.soundEnabled ?? true,
      },
    });
    return {
      minutesBefore: row.minutesBefore,
      soundEnabled: row.soundEnabled,
    };
  }

  async recordAbsence(
    userId: string,
    studentId: string,
    tripId: string,
    dto: RecordAbsenceDto = {},
  ) {
    return this.absences.recordByTrip(userId, studentId, tripId, dto);
  }

  async recordAbsenceByDate(
    userId: string,
    studentId: string,
    dto: RecordDateAbsenceDto,
  ) {
    return this.absences.recordByDate(userId, studentId, dto);
  }

  async studentNonSchoolDays(
    userId: string,
    studentId: string,
    query: DateRangeQueryDto,
  ) {
    return this.absences.listCalendarDays(
      userId,
      studentId,
      query.from,
      query.to,
    );
  }

  async universityMe(userId: string) {
    const profile = await this.requireUniversity(userId);
    const platform = await this.platform.read();
    return mapUniversityMe(
      profile.user,
      profile,
      profile.institution.branding,
      profile.institution,
      {
        tracking: this.platform.trackingFor(
          platform.apps.university,
          platform,
        ),
        platform: this.platform.clientOps(platform),
      },
    );
  }

  async universityRoutes(userId: string, query: UniversityRoutesQueryDto) {
    const profile = await this.requireUniversity(userId);
    const rows = await this.prisma.shuttleRoute.findMany({
      where: {
        institutionId: profile.institutionId,
        archivedAt: null,
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      include: {
        schedules: { where: { isActive: true }, orderBy: { departureTime: 'asc' } },
        _count: { select: { schedules: true, stops: true } },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map(mapPublicRoute);
  }

  async universityRoute(userId: string, routeId: string) {
    const profile = await this.requireUniversity(userId);
    let route = await this.prisma.shuttleRoute.findFirst({
      where: { id: routeId, institutionId: profile.institutionId, archivedAt: null },
      include: {
        schedules: { orderBy: { departureTime: 'asc' } },
        stops: { orderBy: { sequence: 'asc' } },
        _count: { select: { schedules: true, stops: true } },
      },
    });
    if (!route) {
      throw new AppException(
        'ROUTE_NOT_FOUND',
        'Route not found',
        HttpStatus.NOT_FOUND,
      );
    }
    let polylineFields = mapRoutePolylineFields(route);
    if (routeNeedsPolylineRefresh(route)) {
      polylineFields = await refreshShuttleRoutePolylines(
        this.prisma,
        this.routing,
        route.id,
      );
      route = {
        ...route,
        polylineOutbound: polylineFields.polylines.OUTBOUND,
        polylineInbound: polylineFields.polylines.INBOUND,
        polylinePrecision: polylineFields.polylinePrecision,
      };
    }
    return {
      ...mapPublicRoute(route),
      ...polylineFields,
      stops: route.stops.map((stop) => ({
        id: stop.id,
        sequence: stop.sequence,
        stopType: stop.stopType,
        label: stop.label,
        latitude: stop.latitude,
        longitude: stop.longitude,
        direction: stop.direction,
      })),
    };
  }

  async universitySchedules(userId: string, routeId: string) {
    const detail = await this.universityRoute(userId, routeId);
    return detail.schedules ?? [];
  }

  async universityToday(userId: string, query: UniversityTripsQueryDto) {
    const profile = await this.requireUniversity(userId);
    const timezone = await this.timezone(profile.institutionId);
    const serviceDate = query.date
      ? parseServiceDate(query.date)
      : todayInTimezone(timezone);
    const trips = await this.prisma.shuttleTrip.findMany({
      where: {
        institutionId: profile.institutionId,
        serviceDate,
        ...(query.direction ? { direction: query.direction } : {}),
        ...(query.routeId ? { routeId: query.routeId } : {}),
      },
      include: universityTripInclude,
      orderBy: { scheduledDepartureTime: 'asc' },
    });
    const institutionName =
      profile.institution.displayName?.trim() || profile.institution.name;
    const userPoint =
      query.lat != null && query.lng != null
        ? { lat: query.lat, lng: query.lng }
        : null;
    const now = new Date();
    const rows = [];
    for (const trip of trips) {
      const nearestDistance = userPoint
        ? nearestStopDistanceMeters(userPoint, trip.stops, haversineMeters)
        : null;
      if (
        userPoint &&
        query.maxDistanceMeters != null &&
        (nearestDistance == null || nearestDistance > query.maxDistanceMeters)
      ) {
        continue;
      }

      const nextPending = [...trip.stops]
        .sort((a, b) => a.sequence - b.sequence)
        .find((stop) => stop.arrivedAt == null);
      const etaMinutes = universityEtaMinutes(
        nextPending?.etaAt ?? trip.etaToNextStopAt,
        now,
      );
      if (
        !matchesUniversityEtaFilter(etaMinutes, {
          maxEtaMinutes: query.maxEtaMinutes,
          minEtaMinutes: query.minEtaMinutes,
        })
      ) {
        continue;
      }

      const boardedCount = trip._count.students;
      const capacity = trip.vehicle?.capacity ?? null;
      if (
        query.crowd &&
        !matchesUniversityCrowdFilter(boardedCount, capacity, query.crowd)
      ) {
        continue;
      }

      rows.push(
        await this.decorateUniversityTrip(
          trip,
          profile.institutionId,
          institutionName,
          nearestDistance,
        ),
      );
    }
    return rows;
  }

  async universityLive(userId: string, tripId: string) {
    const profile = await this.requireUniversity(userId);
    const trip = await this.prisma.shuttleTrip.findFirst({
      where: { id: tripId, institutionId: profile.institutionId },
      include: universityTripInclude,
    });
    if (!trip) {
      throw new AppException(
        'TRIP_NOT_FOUND',
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }
    const institutionName =
      profile.institution.displayName?.trim() || profile.institution.name;
    return this.decorateUniversityTrip(
      trip,
      profile.institutionId,
      institutionName,
    );
  }

  private async mapParentStudents(students: ParentStudentRow[]) {
    const summaries = await this.parentStudentSummaries(
      students.map((student) => ({
        id: student.id,
        institutionId: student.institutionId,
      })),
    );
    return students.map((student) =>
      mapPassengerStudent(student, summaries.get(student.id)),
    );
  }

  /** Batch active-trip + last drop-off for Parent Home (avoids 1+2N). */
  private async parentStudentSummaries(
    students: Array<{ id: string; institutionId: string }>,
  ) {
    const empty = {
      activeTripId: null as string | null,
      lastDroppedOffAt: null as Date | null,
    };
    const summaries = new Map(
      students.map((student) => [student.id, { ...empty }]),
    );
    if (students.length === 0) {
      return summaries;
    }

    const studentIds = students.map((student) => student.id);
    const dropoffs = await this.prisma.tripStudent.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        droppedOffAt: { not: null },
      },
      _max: { droppedOffAt: true },
    });
    for (const row of dropoffs) {
      const summary = summaries.get(row.studentId);
      if (summary) {
        summary.lastDroppedOffAt = row._max.droppedOffAt;
      }
    }

    const byInstitution = new Map<string, string[]>();
    for (const student of students) {
      const list = byInstitution.get(student.institutionId) ?? [];
      list.push(student.id);
      byInstitution.set(student.institutionId, list);
    }

    await Promise.all(
      [...byInstitution.entries()].map(async ([institutionId, ids]) => {
        const today = todayInTimezone(await this.timezone(institutionId));
        const rows = await this.prisma.tripStudent.findMany({
          where: {
            studentId: { in: ids },
            trip: {
              serviceDate: today,
              status: { in: [TripStatus.IN_PROGRESS, TripStatus.SCHEDULED] },
            },
          },
          select: {
            studentId: true,
            tripId: true,
            trip: { select: { status: true } },
          },
        });
        const best = new Map<string, { tripId: string; status: TripStatus }>();
        for (const row of rows) {
          const current = best.get(row.studentId);
          if (
            !current ||
            (row.trip.status === TripStatus.IN_PROGRESS &&
              current.status !== TripStatus.IN_PROGRESS)
          ) {
            best.set(row.studentId, {
              tripId: row.tripId,
              status: row.trip.status,
            });
          }
        }
        for (const [studentId, pick] of best) {
          const summary = summaries.get(studentId);
          if (summary) {
            summary.activeTripId = pick.tripId;
          }
        }
      }),
    );

    return summaries;
  }

  private async decorateLive(
    trip: Parameters<typeof mapPassengerLive>[0]['trip'],
    studentStatus: string | null,
    institutionId: string,
    studentStopId: string | null = null,
  ) {
    const location = await this.live.readLocation(trip.id);
    const staleAfter = await this.platform.gpsStaleAfterSeconds(institutionId);
    const branding = await this.prisma.institutionBranding.findUnique({
      where: { institutionId },
    });
    const lastAt = location
      ? new Date(location.recordedAt)
      : trip.lastLocationAt;
    return mapPassengerLive({
      trip,
      location,
      gpsStale: isGpsStale(lastAt, staleAfter),
      studentStatus,
      studentStopId,
      supportPhone: branding?.supportPhone ?? null,
    });
  }

  private async decorateUniversityTrip(
    trip: UniversityTripRow,
    institutionId: string,
    institutionName: string,
    nearestStopDistanceMetersValue: number | null = null,
  ) {
    const location = await this.live.readLocation(trip.id);
    const staleAfter = await this.platform.gpsStaleAfterSeconds(institutionId);
    const branding = await this.prisma.institutionBranding.findUnique({
      where: { institutionId },
    });
    const lastAt = location
      ? new Date(location.recordedAt)
      : trip.lastLocationAt;
    return mapUniversityTripCard({
      trip,
      location,
      gpsStale: isGpsStale(lastAt, staleAfter),
      studentStatus: null,
      studentStopId: null,
      supportPhone: branding?.supportPhone ?? null,
      institutionName,
      boardedCount: trip._count.students,
      vehicle: trip.vehicle,
      attendant: trip.attendant
        ? {
            id: trip.attendant.id,
            fullName: trip.attendant.user.fullName,
            phone: trip.attendant.user.phone,
          }
        : null,
      nearestStopDistanceMeters: nearestStopDistanceMetersValue,
    });
  }

  private async requireParent(userId: string) {
    const user = await this.prisma.shuttleUser.findFirst({
      where: { id: userId, archivedAt: null },
      include: { institution: { include: { branding: true } } },
    });
    if (!user) {
      throw new AppException(
        'USER_NOT_FOUND',
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  private async requireChild(userId: string, studentId: string) {
    const student = await this.prisma.schoolStudent.findFirst({
      where: { id: studentId, guardianUserId: userId, archivedAt: null },
      include: studentInclude,
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

  private async requireUniversity(userId: string) {
    const profile = await this.prisma.universityStudentProfile.findFirst({
      where: { userId, archivedAt: null },
      include: {
        user: true,
        institution: { include: { branding: true } },
      },
    });
    if (!profile) {
      throw new AppException(
        'UNIVERSITY_STUDENT_NOT_FOUND',
        'University student profile not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return profile;
  }

  private async timezone(institutionId: string): Promise<string> {
    const settings = await this.prisma.institutionSettings.findUnique({
      where: { institutionId },
    });
    return settings?.timezone ?? 'Asia/Damascus';
  }
}
