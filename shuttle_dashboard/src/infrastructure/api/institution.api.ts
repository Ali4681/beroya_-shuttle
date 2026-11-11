import type {
  Attendant,
  Attention,
  AuditLog,
  Branch,
  BranchStats,
  Branding,
  CompleteUploadResult,
  Driver,
  GenerationResult,
  Incident,
  IncidentStats,
  InstitutionBootstrap,
  InstitutionDashboardSummary,
  InstitutionProfile,
  InstitutionSearchResult,
  InstitutionSettings,
  LiveTrip,
  MeetingPoint,
  NotificationItem,
  OptimizeStopsResult,
  Parent,
  PresignResult,
  ResourceStats,
  ResourceTrip,
  RouteDetail,
  RouteException,
  RouteSchedule,
  RouteStats,
  RouteStop,
  RouteStudent,
  RouteSummary,
  StudentDetail,
  StudentStats,
  StudentTrip,
  Subscription,
  Trip,
  TripEvent,
  TripStats,
  TripStop,
  TripStudent,
  TripSummary,
  UniversityStudent,
  Vehicle,
} from "@/domain/models/entities";
import type {
  NotificationAudience,
  PickupType,
  ResourceStatus,
  RouteStatus,
  StudentStatus,
  StudentSubscriptionType,
  TripDirection,
  TripStudentStatus,
  VehicleStatus,
} from "@/domain/models/enums";
import type { BrandingInput, DriverInput, VehicleInput } from "@/infrastructure/api/admin.api";
import { http } from "@/infrastructure/http/client";

type Query = Record<string, string | number | boolean | undefined>;
type Success = { success: true };

export type BranchInput = { name: string; address?: string; latitude: number; longitude: number };
export type PickupInput = {
  pickupType: PickupType;
  meetingPointId?: string;
  latitude?: number;
  longitude?: number;
  addressLabel?: string;
};
export type StudentInput = {
  fullName: string;
  branchId: string;
  grade?: string;
  section?: string;
  photoUrl?: string;
  subscriptionType?: StudentSubscriptionType;
};
export type CreateStudentInput = StudentInput & {
  guardian: { fullName: string; phone: string; email: string; password: string };
  pickup: PickupInput;
};
export type UniversityStudentInput = {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  studentNumber?: string;
  faculty?: string;
  branchId?: string;
};
export type MeetingPointInput = {
  name: string;
  latitude: number;
  longitude: number;
  addressLabel?: string;
  branchId?: string;
};
export type AttendantInput = {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  nationalId?: string;
};
export type RouteInput = {
  name: string;
  branchId: string;
  code?: string;
  originLabel?: string;
  originLat: number;
  originLng: number;
  delayThresholdMinutes?: number;
};
export type ScheduleInput = {
  direction: TripDirection;
  departureTime: string;
  daysOfWeek: number[];
  isActive?: boolean;
};
export type CrewInput = {
  driverId?: string | null;
  vehicleId?: string | null;
  attendantId?: string | null;
};
export type OverrideInput = CrewInput & {
  departureTime?: string;
  originLat?: number;
  originLng?: number;
  originLabel?: string;
  notifyUsers?: boolean;
};
export type ReassignInput = CrewInput & {
  incidentId?: string;
  reason?: string;
  notifyUsers?: boolean;
};
export type SettingsInput = Partial<InstitutionSettings>;
export type ProfileInput = {
  name?: string;
  displayName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
};

export const institutionApi = {
  bootstrap: () => http.get<InstitutionBootstrap>("/institution/bootstrap"),
  profile: () => http.get<InstitutionProfile>("/institution/profile"),
  updateProfile: (body: ProfileInput) => http.patch<InstitutionProfile>("/institution/profile", body),
  branding: () => http.get<Branding | null>("/institution/branding"),
  updateBranding: (body: BrandingInput) => http.patch<Branding>("/institution/branding", body),
  settings: () => http.get<InstitutionSettings | null>("/institution/settings"),
  updateSettings: (body: SettingsInput) => http.patch<InstitutionSettings>("/institution/settings", body),
  subscription: () => http.get<Subscription | null>("/institution/subscription"),

  dashboardSummary: (branchId?: string) =>
    http.get<InstitutionDashboardSummary>("/institution/dashboard/summary", { branchId }),
  attention: () => http.get<Attention>("/institution/dashboard/attention"),
  liveTrips: () => http.get<LiveTrip[]>("/institution/dashboard/live-trips"),
  liveMap: (query: Query = {}) => http.get<LiveTrip[]>("/institution/live-map", query),
  tripLive: (id: string) => http.get<LiveTrip>(`/institution/trips/${id}/live`),

  branches: () => http.get<Branch[]>("/institution/branches"),
  branch: (id: string) => http.get<Branch>(`/institution/branches/${id}`),
  branchStats: (id: string) => http.get<BranchStats>(`/institution/branches/${id}/stats`),
  createBranch: (body: BranchInput) => http.post<Branch>("/institution/branches", body),
  updateBranch: (id: string, body: Partial<BranchInput>) =>
    http.patch<Branch>(`/institution/branches/${id}`, body),
  setBranchStatus: (id: string, status: ResourceStatus) =>
    http.patch<Branch>(`/institution/branches/${id}/status`, { status }),
  deleteBranch: (id: string) => http.delete<Success>(`/institution/branches/${id}`),

  drivers: (query: Query) => http.page<Driver>("/institution/drivers", query),
  driverStats: () => http.get<ResourceStats>("/institution/drivers/stats"),
  driver: (id: string) => http.get<Driver>(`/institution/drivers/${id}`),
  createDriver: (body: DriverInput) => http.post<Driver>("/institution/drivers", body),
  updateDriver: (id: string, body: DriverInput) => http.patch<Driver>(`/institution/drivers/${id}`, body),
  setDriverStatus: (id: string, status: ResourceStatus) =>
    http.patch<Driver>(`/institution/drivers/${id}/status`, { status }),
  driverTrips: (id: string, query: Query = {}) =>
    http.page<ResourceTrip>(`/institution/drivers/${id}/trips`, query),

  vehicles: (query: Query) => http.page<Vehicle>("/institution/vehicles", query),
  vehicleStats: () => http.get<ResourceStats>("/institution/vehicles/stats"),
  createVehicle: (body: VehicleInput) => http.post<Vehicle>("/institution/vehicles", body),
  updateVehicle: (id: string, body: VehicleInput) => http.patch<Vehicle>(`/institution/vehicles/${id}`, body),
  setVehicleStatus: (id: string, status: VehicleStatus) =>
    http.patch<Vehicle>(`/institution/vehicles/${id}/status`, { status }),

  attendants: (query: Query) => http.page<Attendant>("/institution/attendants", query),
  createAttendant: (body: AttendantInput) => http.post<Attendant>("/institution/attendants", body),
  updateAttendant: (id: string, body: AttendantInput) =>
    http.patch<Attendant>(`/institution/attendants/${id}`, body),
  setAttendantStatus: (id: string, status: ResourceStatus) =>
    http.patch<Attendant>(`/institution/attendants/${id}/status`, { status }),

  availableDrivers: (query: Query = {}) => http.get<Driver[]>("/institution/resources/available-drivers", query),
  availableVehicles: (query: Query = {}) =>
    http.get<Vehicle[]>("/institution/resources/available-vehicles", query),
  availableAttendants: (query: Query = {}) =>
    http.get<Attendant[]>("/institution/resources/available-attendants", query),

  students: (query: Query) => http.page<StudentDetail>("/institution/students", query),
  studentStats: () => http.get<StudentStats>("/institution/students/stats"),
  student: (id: string) => http.get<StudentDetail>(`/institution/students/${id}`),
  createStudent: (body: CreateStudentInput) => http.post<StudentDetail>("/institution/students", body),
  updateStudent: (id: string, body: Partial<StudentInput>) =>
    http.patch<StudentDetail>(`/institution/students/${id}`, body),
  setStudentStatus: (id: string, status: StudentStatus) =>
    http.patch<StudentDetail>(`/institution/students/${id}/status`, { status }),
  updateGuardian: (
    id: string,
    body: { fullName: string; phone: string; email: string; password?: string },
  ) =>
    http.patch<StudentDetail>(`/institution/students/${id}/guardian`, body),
  updatePickup: (id: string, body: PickupInput) =>
    http.patch<StudentDetail>(`/institution/students/${id}/pickup`, body),
  studentTrips: (id: string, query: Query = {}) =>
    http.page<StudentTrip>(`/institution/students/${id}/trips`, query),
  boardingHistory: (id: string, query: Query = {}) =>
    http.page<StudentTrip>(`/institution/students/${id}/boarding-history`, query),
  routeExceptions: (id: string) => http.get<RouteException[]>(`/institution/students/${id}/route-exceptions`),
  createRouteException: (
    id: string,
    body: { overrideRouteId: string; direction?: TripDirection; date: string; reason?: string },
  ) => http.post<RouteException>(`/institution/students/${id}/route-exceptions`, body),
  deleteRouteException: (id: string, eid: string) =>
    http.delete<Success>(`/institution/students/${id}/route-exceptions/${eid}`),

  parents: (query: Query) => http.page<Parent>("/institution/parents", query),
  parent: (id: string) => http.get<Parent>(`/institution/parents/${id}`),
  updateParent: (
    id: string,
    body: { fullName?: string; phone?: string; email?: string; password?: string },
  ) =>
    http.patch<Parent>(`/institution/parents/${id}`, body),

  universityStudents: (query: Query) =>
    http.page<UniversityStudent>("/institution/university-students", query),
  universityStudentStats: () =>
    http.get<{ total: number; active: number; inactive?: number }>("/institution/university-students/stats"),
  createUniversityStudent: (body: UniversityStudentInput) =>
    http.post<UniversityStudent>("/institution/university-students", body),
  updateUniversityStudent: (id: string, body: UniversityStudentInput) =>
    http.patch<UniversityStudent>(`/institution/university-students/${id}`, body),
  setUniversityStudentStatus: (id: string, status: StudentStatus) =>
    http.patch<UniversityStudent>(`/institution/university-students/${id}/status`, { status }),

  meetingPoints: (query: Query = {}) => http.get<MeetingPoint[]>("/institution/meeting-points", query),
  createMeetingPoint: (body: MeetingPointInput) =>
    http.post<MeetingPoint>("/institution/meeting-points", body),
  updateMeetingPoint: (id: string, body: Partial<MeetingPointInput>) =>
    http.patch<MeetingPoint>(`/institution/meeting-points/${id}`, body),
  setMeetingPointStatus: (id: string, status: ResourceStatus) =>
    http.patch<MeetingPoint>(`/institution/meeting-points/${id}/status`, { status }),
  deleteMeetingPoint: (id: string) => http.delete<Success>(`/institution/meeting-points/${id}`),

  routes: (query: Query) => http.page<RouteSummary>("/institution/routes", query),
  routeStats: () => http.get<RouteStats>("/institution/routes/stats"),
  route: (id: string) => http.get<RouteDetail>(`/institution/routes/${id}`),
  createRoute: (body: RouteInput) => http.post<RouteDetail>("/institution/routes", body),
  updateRoute: (id: string, body: Partial<RouteInput>) =>
    http.patch<RouteDetail>(`/institution/routes/${id}`, body),
  setRouteStatus: (id: string, status: RouteStatus, notifyUsers: boolean) =>
    http.patch<RouteDetail>(`/institution/routes/${id}/status`, { status, notifyUsers }),
  setDefaultAssignment: (id: string, body: CrewInput) =>
    http.patch<RouteDetail>(`/institution/routes/${id}/default-assignment`, body),
  routeStudents: (id: string) => http.get<RouteStudent[]>(`/institution/routes/${id}/students`),
  assignRouteStudents: (id: string, studentIds: string[]) =>
    http.post<RouteDetail>(`/institution/routes/${id}/students`, { studentIds }),
  removeRouteStudent: (id: string, studentId: string) =>
    http.delete<RouteDetail>(`/institution/routes/${id}/students/${studentId}`),
  schedules: (id: string) => http.get<RouteSchedule[]>(`/institution/routes/${id}/schedules`),
  createSchedule: (id: string, body: ScheduleInput) =>
    http.post<RouteSchedule>(`/institution/routes/${id}/schedules`, body),
  updateSchedule: (id: string, sid: string, body: Partial<ScheduleInput>) =>
    http.patch<RouteSchedule>(`/institution/routes/${id}/schedules/${sid}`, body),
  deleteSchedule: (id: string, sid: string) =>
    http.delete<Success>(`/institution/routes/${id}/schedules/${sid}`),
  stops: (id: string, direction: TripDirection) =>
    http.get<RouteStop[]>(`/institution/routes/${id}/stops`, { direction }),
  createStop: (
    id: string,
    body: { direction: TripDirection; label?: string; latitude: number; longitude: number },
  ) => http.post<RouteStop>(`/institution/routes/${id}/stops`, body),
  updateStop: (id: string, stopId: string, body: { label?: string; latitude?: number; longitude?: number }) =>
    http.patch<RouteStop>(`/institution/routes/${id}/stops/${stopId}`, body),
  deleteStop: (id: string, stopId: string) =>
    http.delete<Success>(`/institution/routes/${id}/stops/${stopId}`),
  optimizeStops: (id: string, direction: TripDirection) =>
    http.post<OptimizeStopsResult>(`/institution/routes/${id}/optimize-stops`, { direction }),
  saveStopOrder: (id: string, direction: TripDirection, stops: { stopId: string; sequence: number }[]) =>
    http.put<RouteDetail>(`/institution/routes/${id}/stop-order`, { direction, stops }),

  trips: (query: Query) => http.page<Trip>("/institution/trips", query),
  tripStats: (date?: string) => http.get<TripStats>("/institution/trips/stats", { date }),
  generateTrips: (date: string, routeId?: string) =>
    http.post<GenerationResult>("/institution/trips/generate", { date, routeId }),
  trip: (id: string) => http.get<Trip>(`/institution/trips/${id}`),
  tripSummary: (id: string) => http.get<TripSummary>(`/institution/trips/${id}/summary`),
  tripStops: (id: string) => http.get<TripStop[]>(`/institution/trips/${id}/stops`),
  tripStudents: (id: string) => http.get<TripStudent[]>(`/institution/trips/${id}/students`),
  tripEvents: (id: string) => http.get<TripEvent[]>(`/institution/trips/${id}/events`),
  overrideTrip: (id: string, body: OverrideInput) => http.patch<Trip>(`/institution/trips/${id}/override`, body),
  reassignTrip: (id: string, body: ReassignInput) => http.post<Trip>(`/institution/trips/${id}/reassign`, body),
  cancelTrip: (id: string, reason: string, notifyUsers: boolean) =>
    http.post<Trip>(`/institution/trips/${id}/cancel`, { reason, notifyUsers }),
  correctTripStudent: (tripId: string, tripStudentId: string, status: TripStudentStatus) =>
    http.patch<TripStudent>(`/institution/trips/${tripId}/students/${tripStudentId}/status`, { status }),

  incidents: (query: Query) => http.page<Incident>("/institution/incidents", query),
  incidentStats: () => http.get<IncidentStats>("/institution/incidents/stats"),
  incident: (id: string) => http.get<Incident>(`/institution/incidents/${id}`),
  resolveIncident: (id: string, resolutionNotes: string) =>
    http.post<Incident>(`/institution/incidents/${id}/resolve`, { resolutionNotes }),

  notifications: (query: Query) => http.page<NotificationItem>("/institution/notifications", query),
  notification: (id: string) => http.get<NotificationItem>(`/institution/notifications/${id}`),
  audiencePreview: (audience: NotificationAudience, routeId?: string) =>
    http.post<{ recipientsCount: number }>("/institution/notifications/audience-preview", {
      audience,
      routeId,
    }),
  sendNotification: (
    body: { audience: NotificationAudience; routeId?: string; title: string; body: string },
    idempotencyKey: string,
  ) => http.post<NotificationItem>("/institution/notifications", body, { idempotencyKey }),

  search: (q: string, branchId?: string) =>
    http.get<InstitutionSearchResult>("/institution/search", { q, branchId }),
  auditLogs: (query: Query) => http.page<AuditLog>("/institution/audit-logs", query),

  presign: (purpose: "logo" | "student_photo", contentType: string, byteSize: number) =>
    http.post<PresignResult>("/institution/uploads/presign", { purpose, contentType, byteSize }),
  completeUpload: (purpose: "logo" | "student_photo", objectKey: string) =>
    http.post<CompleteUploadResult>("/institution/uploads/complete", { purpose, objectKey }),
};
