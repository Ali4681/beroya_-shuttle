import type {
  AdminDashboardSummary,
  AdminIncident,
  AdminLiveTrip,
  AdminSearchResult,
  AdminTrip,
  AdminTripDetail,
  IncidentStats,
  TripStats,
  AuditLog,
  Branch,
  Branding,
  CompleteUploadResult,
  Driver,
  InstitutionDetail,
  InstitutionSettings,
  InstitutionStats,
  InstitutionSummary,
  InstitutionsDistribution,
  OperationsRow,
  PlatformSettings,
  AppBrandingAdmin,
  AppBrandingInput,
  MobileAppKey,
  PresignResult,
  ResourceTrip,
  Subscription,
  User,
  Vehicle,
} from "@/domain/models/entities";
import type {
  BillingPeriod,
  InstitutionStatus,
  InstitutionType,
  OperationModel,
  ResourceStatus,
  VehicleStatus,
} from "@/domain/models/enums";
import type { BranchInput } from "@/infrastructure/api/institution.api";
import { http } from "@/infrastructure/http/client";

type Query = Record<string, string | number | boolean | undefined>;

export type InstitutionInput = {
  name: string;
  displayName?: string;
  type: InstitutionType;
  operationModel?: OperationModel;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
};

export type CreateInstitutionInput = InstitutionInput & {
  admin: { fullName: string; phone: string; email: string; password: string };
  defaultBranch?: { name?: string; address?: string };
};

export type SubscriptionInput = {
  billingPeriod: BillingPeriod;
  startsAt: string;
  endsAt: string;
  agreedAmount: number;
  currencyCode?: string;
  notes?: string;
};

export type BrandingInput = Partial<Omit<Branding, "logoUrl">> & { logoUrl?: string | null };

export type NestedDriverInput = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  nationalId?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
};

export type NestedVehicleInput = {
  plateNumber: string;
  vehicleType?: string;
  capacity?: number;
  licenseExpiry?: string;
  insuranceExpiry?: string;
};

export type DriverInput = {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  nationalId?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  institutionId?: string | null;
  vehicleId?: string | null;
  newVehicle?: NestedVehicleInput;
  dailyTripsLimit?: number | null;
};

export type VehicleInput = {
  plateNumber?: string;
  vehicleType?: string;
  capacity?: number;
  licenseExpiry?: string;
  insuranceExpiry?: string;
  ownerType?: "BEROYA" | "DRIVER" | "INSTITUTION";
  institutionId?: string | null;
  driverId?: string | null;
  newDriver?: NestedDriverInput;
};

export const adminApi = {
  bootstrap: () => http.get<{ user: User }>("/admin/bootstrap"),
  platformSettings: () => http.get<PlatformSettings>("/admin/platform-settings"),
  updatePlatformSettings: (body: Partial<PlatformSettings> & Record<string, unknown>) =>
    http.put<PlatformSettings>("/admin/platform-settings", body),
  updateSupportContact: (supportPhone: string | null) =>
    http.put<{ supportPhone: string | null }>("/admin/support-contact", { supportPhone }),

  appBranding: (app: MobileAppKey) =>
    http.get<AppBrandingAdmin>("/admin/app-branding", { app }),
    saveAppBranding: (app: MobileAppKey, body: AppBrandingInput) =>
    http.put<AppBrandingAdmin>("/admin/app-branding", body, { query: { app } }),
  publishAppBranding: (app: MobileAppKey) =>
    http.post<AppBrandingAdmin>("/admin/app-branding/publish", {}, { query: { app } }),
  presignAppBranding: (app: MobileAppKey, purpose: string, contentType: string, byteSize: number, fileName?: string) =>
    http.post<PresignResult>(
      "/admin/app-branding/uploads/presign",
      { purpose, contentType, byteSize, fileName },
      { query: { app } },
    ),
  completeAppBranding: (app: MobileAppKey, purpose: string, objectKey: string) =>
    http.post<CompleteUploadResult>(
      "/admin/app-branding/uploads/complete",
      { purpose, objectKey },
      { query: { app } },
    ),

  dashboardSummary: () => http.get<AdminDashboardSummary>("/admin/dashboard/summary"),
  distribution: () => http.get<InstitutionsDistribution>("/admin/dashboard/institutions-distribution"),
  recentInstitutions: () => http.get<InstitutionSummary[]>("/admin/dashboard/recent-institutions"),
  expiringSubscriptions: () => http.get<Subscription[]>("/admin/dashboard/expiring-subscriptions"),
  operations: () => http.get<OperationsRow[]>("/admin/dashboard/operations"),

  opsTrips: (query: Query) => http.page<AdminTrip>("/admin/operations/trips", query),
  opsTripStats: (date?: string) => http.get<TripStats>("/admin/operations/trips/stats", { date }),
  opsTrip: (id: string) => http.get<AdminTripDetail>(`/admin/operations/trips/${id}`),
  opsLiveMap: () => http.get<AdminLiveTrip[]>("/admin/operations/live-map"),
  opsIncidents: (query: Query) => http.page<AdminIncident>("/admin/operations/incidents", query),
  opsIncidentStats: () => http.get<IncidentStats>("/admin/operations/incidents/stats"),

  institutions: (query: Query) => http.page<InstitutionSummary>("/admin/institutions", query),
  allInstitutions: async () => {
    const first = await http.page<InstitutionSummary>("/admin/institutions", { page: 1, limit: 100 });
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, first.meta.totalPages - 1) }, (_, i) =>
        http.page<InstitutionSummary>("/admin/institutions", { page: i + 2, limit: 100 }),
      ),
    );
    return [first, ...rest].flatMap((page) => page.data);
  },
  institution: (id: string) => http.get<InstitutionDetail>(`/admin/institutions/${id}`),
  createInstitution: (body: CreateInstitutionInput) =>
    http.post<InstitutionDetail>("/admin/institutions", body),
  updateInstitution: (id: string, body: Partial<InstitutionInput>) =>
    http.patch<InstitutionDetail>(`/admin/institutions/${id}`, body),
  setInstitutionStatus: (id: string, status: InstitutionStatus, reason?: string) =>
    http.patch<InstitutionDetail>(`/admin/institutions/${id}/status`, { status, reason }),
  changeAdmin: (
    id: string,
    body: { fullName: string; phone: string; email: string; password: string; keepOldAsOperator?: boolean },
  ) =>
    http.post<InstitutionDetail>(`/admin/institutions/${id}/change-admin`, body),
  institutionStats: (id: string) => http.get<InstitutionStats>(`/admin/institutions/${id}/stats`),
  institutionBranches: (id: string) => http.get<Branch[]>(`/admin/institutions/${id}/branches`),
  createBranch: (id: string, body: BranchInput) =>
    http.post<Branch>(`/admin/institutions/${id}/branches`, body),
  updateBranch: (id: string, branchId: string, body: Partial<BranchInput>) =>
    http.patch<Branch>(`/admin/institutions/${id}/branches/${branchId}`, body),
  setBranchStatus: (id: string, branchId: string, status: ResourceStatus) =>
    http.patch<Branch>(`/admin/institutions/${id}/branches/${branchId}/status`, { status }),
  deleteBranch: (id: string, branchId: string) =>
    http.delete<{ success: boolean }>(`/admin/institutions/${id}/branches/${branchId}`),
  institutionBranding: (id: string) => http.get<Branding | null>(`/admin/institutions/${id}/branding`),
  updateBranding: (id: string, body: BrandingInput) =>
    http.patch<Branding>(`/admin/institutions/${id}/branding`, body),
  institutionSettings: (id: string) =>
    http.get<InstitutionSettings | null>(`/admin/institutions/${id}/settings`),
  updateSettings: (id: string, body: Partial<InstitutionSettings>) =>
    http.patch<InstitutionSettings>(`/admin/institutions/${id}/settings`, body),
  presignLogo: (id: string, contentType: string, byteSize: number) =>
    http.post<PresignResult>(`/admin/institutions/${id}/uploads/presign`, {
      purpose: "logo",
      contentType,
      byteSize,
    }),
  completeLogo: (id: string, objectKey: string) =>
    http.post<CompleteUploadResult>(`/admin/institutions/${id}/uploads/complete`, {
      purpose: "logo",
      objectKey,
    }),

  subscriptions: (query: Query) => http.page<Subscription>("/admin/subscriptions", query),
  institutionSubscriptions: (id: string, query: Query = {}) =>
    http.page<Subscription>(`/admin/institutions/${id}/subscriptions`, query),
  createSubscription: (id: string, body: SubscriptionInput) =>
    http.post<Subscription>(`/admin/institutions/${id}/subscriptions`, body),
  updateSubscription: (id: string, sid: string, body: Partial<SubscriptionInput>) =>
    http.patch<Subscription>(`/admin/institutions/${id}/subscriptions/${sid}`, body),
  activateSubscription: (id: string, sid: string) =>
    http.post<Subscription>(`/admin/institutions/${id}/subscriptions/${sid}/activate`),
  cancelSubscription: (id: string, sid: string, reason: string) =>
    http.post<Subscription>(`/admin/institutions/${id}/subscriptions/${sid}/cancel`, { reason }),
  extendSubscription: (id: string, sid: string, newEndDate: string) =>
    http.post<Subscription>(`/admin/institutions/${id}/subscriptions/${sid}/extend`, { newEndDate }),

  drivers: (query: Query) => http.page<Driver>("/admin/drivers", query),
  driver: (id: string) => http.get<Driver>(`/admin/drivers/${id}`),
  createDriver: (body: DriverInput) => http.post<Driver>("/admin/drivers", body),
  updateDriver: (id: string, body: DriverInput) => http.patch<Driver>(`/admin/drivers/${id}`, body),
  setDriverStatus: (id: string, status: ResourceStatus) =>
    http.patch<Driver>(`/admin/drivers/${id}/status`, { status }),
  driverTrips: (id: string, query: Query = {}) =>
    http.page<ResourceTrip>(`/admin/drivers/${id}/trips`, query),

  vehicles: (query: Query) => http.page<Vehicle>("/admin/vehicles", query),
  vehicle: (id: string) => http.get<Vehicle>(`/admin/vehicles/${id}`),
  createVehicle: (body: VehicleInput) => http.post<Vehicle>("/admin/vehicles", body),
  updateVehicle: (id: string, body: VehicleInput) => http.patch<Vehicle>(`/admin/vehicles/${id}`, body),
  setVehicleStatus: (id: string, status: VehicleStatus) =>
    http.patch<Vehicle>(`/admin/vehicles/${id}/status`, { status }),
  vehicleTrips: (id: string, query: Query = {}) =>
    http.page<ResourceTrip>(`/admin/vehicles/${id}/trips`, query),

  search: (q: string) => http.get<AdminSearchResult>("/admin/search", { q }),
  auditLogs: (query: Query) => http.page<AuditLog>("/admin/audit-logs", query),
  auditLog: (id: string) => http.get<AuditLog>(`/admin/audit-logs/${id}`),
};
