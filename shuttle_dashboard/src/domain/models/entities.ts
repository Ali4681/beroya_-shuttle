import type {
  BillingPeriod,
  DeliveryStatus,
  IncidentStatus,
  IncidentType,
  InstitutionStatus,
  InstitutionType,
  NotificationAudience,
  NotificationOrigin,
  OperationModel,
  OwnerType,
  PickupType,
  ResourceStatus,
  Role,
  RouteStatus,
  StopType,
  StudentStatus,
  StudentSubscriptionType,
  SubscriptionStatus,
  TripDirection,
  TripStatus,
  TripStopStatus,
  TripStudentStatus,
  UserStatus,
  VehicleStatus,
} from "./enums";

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PageMeta;
};

export type User = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  institutionId: string | null;
  branchId: string | null;
  lastLoginAt: string | null;
  phoneVerifiedAt: string | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: User;
};

export type InstitutionRef = {
  id: string;
  name: string;
  displayName: string | null;
  type: InstitutionType;
  operationModel: OperationModel;
  status: InstitutionStatus;
};

export type Branding = {
  useInstitutionIdentity: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  welcomeMessage: string | null;
  supportPhone: string | null;
};

export type InstitutionSettings = {
  timezone: string;
  defaultDelayThresholdMinutes: number;
  defaultParentArrivalAlertMinutes: number;
  gpsStaleAfterSeconds: number;
  locationPingIntervalSeconds: number;
};

export type StoreRelease = {
  minVersion: string;
  latestVersion: string;
  storeUrl: string | null;
};

export type AppRelease = {
  ios: StoreRelease;
  android: StoreRelease;
  forceMessage: string | null;
};

export type LocalizedCopy = {
  titleAr: string;
  bodyAr: string;
  titleEn: string;
  bodyEn: string;
};

export type PlatformSettings = {
  supportPhone: string | null;
  supportWhatsappUrl: string | null;
  gpsStaleAfterSeconds: number;
  locationPingIntervalSeconds: number;
  maintenance: {
    apps: boolean;
    dashboard: boolean;
    messageAr: string | null;
    messageEn: string | null;
  };
  announcement: { enabled: boolean } & LocalizedCopy;
  fcm: {
    parents: boolean;
    university: boolean;
    drivers: boolean;
    attendants: boolean;
    admins: boolean;
  };
  templates: {
    delay: LocalizedCopy;
    emergency: LocalizedCopy;
    arrivalSoon: LocalizedCopy;
  };
  apps: {
    driver: AppRelease;
    attendant: AppRelease;
    parent: AppRelease;
    university: AppRelease;
  };
  updatedAt: string;
};

export type MobileAppKey = "passenger" | "crew";

export type SplashAnimationType = "none" | "image" | "gif" | "lottie";

export type BundledAppIcon = {
  id: string;
  name: string;
  preview: string;
  android: boolean;
  ios: boolean;
};

export type AppBrandingConfig = {
  app: MobileAppKey;
  version: number;
  logo: string | null;
  colors: {
    primary: string;
    secondary: string;
    background: string;
  };
  splash: {
    image: string | null;
    animation: string | null;
    animationType: SplashAnimationType;
    duration: number;
    enabled: boolean;
  };
  animations: {
    loading: string | null;
    home: string | null;
    success: string | null;
    error: string | null;
    empty: string | null;
  };
  appIcon: {
    android: string;
    ios: string;
  };
  updatedAt: string;
};

export type AppBrandingAdmin = {
  app: MobileAppKey;
  version: number;
  published: AppBrandingConfig;
  draft: AppBrandingConfig;
  hasUnpublishedChanges: boolean;
  availableIcons: BundledAppIcon[];
  updatedAt: string;
};

export type AppBrandingInput = {
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  splash?: {
    imageUrl?: string | null;
    animationUrl?: string | null;
    animationType?: SplashAnimationType;
    duration?: number;
    enabled?: boolean;
  };
  animations?: Partial<AppBrandingConfig["animations"]>;
  appIcon?: Partial<AppBrandingConfig["appIcon"]>;
};

export type Branch = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ResourceStatus;
};

export type InstitutionProfile = InstitutionRef & {
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Subscription = {
  id: string;
  institutionId: string;
  billingPeriod: BillingPeriod;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string;
  agreedAmount: string;
  currencyCode: string;
  notes: string | null;
  activatedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  daysRemaining?: number;
  institution?: InstitutionRef;
};

export type InstitutionSummary = InstitutionRef & {
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  statusReason: string | null;
  primaryAdminUserId: string | null;
  primaryAdmin: User | null;
  currentSubscription: Subscription | null;
  branchCount: number;
  createdAt: string;
  updatedAt: string;
};

export type InstitutionDetail = InstitutionSummary & {
  settings: InstitutionSettings | null;
  branding: Branding | null;
  branches: Branch[];
};

export type InstitutionBootstrap = {
  user: User;
  institution: InstitutionRef;
  branding: Branding | null;
  settings: InstitutionSettings | null;
  branches: Branch[];
};

export type InstitutionStats = {
  institutionId: string;
  timezone: string;
  serviceDate: string;
  currentSubscription: Subscription | null;
  counts: {
    branches: number;
    users: number;
    students: number;
    universityStudents: number;
    drivers: number;
    vehicles: number;
    attendants: number;
    routes: number;
    tripsToday: number;
  };
};

export type CountRecord = Record<string, number>;

export type AdminDashboardSummary = {
  institutionsTotal: number;
  institutionsByStatus: CountRecord;
  institutionsByType: CountRecord;
  institutionsByOperationModel: CountRecord;
  activeSubscriptions: number;
  pendingSubscriptions: number;
  expiringSubscriptions30d: number;
  beroyaDrivers: number;
  beroyaVehicles: number;
  tripsToday: number;
  tripsInProgress: number;
};

export type DistributionRow = { key: string; count: number };

export type InstitutionsDistribution = {
  byType: DistributionRow[];
  byOperationModel: DistributionRow[];
  byStatus: DistributionRow[];
};

export type OperationsRow = {
  id: string;
  name: string;
  displayName: string | null;
  type: InstitutionType;
  operationModel: OperationModel;
  status: InstitutionStatus;
  todayTrips: number;
  inProgress: number;
  delayed: number;
  openIncidents: number;
};

export type PersonRef = { id: string; user: User | null };

export type AssignedRouteRef = {
  id: string;
  name: string;
  status: RouteStatus;
  needsReassignment?: boolean;
};

export type DriverVehicleRef = {
  id: string;
  plateNumber: string;
  vehicleType: string | null;
  capacity: number | null;
  licenseExpiry: string | null;
  insuranceExpiry: string | null;
  ownerType: OwnerType;
  status: VehicleStatus;
};

export type VehicleDriverRef = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: ResourceStatus;
};

export type Driver = {
  id: string;
  userId: string;
  institutionId: string | null;
  ownerType: OwnerType;
  nationalId: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  primaryVehicleId: string | null;
  primaryVehicle: DriverVehicleRef | null;
  /** Daily trip quota for Beroya-operated institutions (1–10). */
  dailyTripsLimit: number | null;
  status: ResourceStatus;
  assigned: boolean;
  assignedRoutes: AssignedRouteRef[];
  user: User | null;
  createdAt: string;
  updatedAt: string;
};

export type Vehicle = {
  id: string;
  institutionId: string | null;
  ownerType: OwnerType;
  ownerDriverId: string | null;
  ownerDriver: VehicleDriverRef | null;
  plateNumber: string;
  vehicleType: string | null;
  capacity: number | null;
  licenseExpiry: string | null;
  insuranceExpiry: string | null;
  status: VehicleStatus;
  assigned: boolean;
  assignedRoutes: AssignedRouteRef[];
  createdAt: string;
  updatedAt: string;
};

export type Attendant = {
  id: string;
  userId: string;
  institutionId: string;
  nationalId: string | null;
  status: ResourceStatus;
  assigned: boolean;
  assignedRoute: AssignedRouteRef | null;
  user: User | null;
  createdAt: string;
  updatedAt: string;
};

export type ResourceStats = {
  total: number;
  active: number;
  suspended: number;
  underMaintenance?: number;
  assigned: number;
  unassigned: number;
};

export type MeetingPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  addressLabel: string | null;
  branchId: string | null;
  status: ResourceStatus;
  createdAt: string;
  updatedAt: string;
};

export type Pickup = {
  pickupType: PickupType;
  meetingPointId: string | null;
  meetingPoint: MeetingPoint | null;
  latitude: number | null;
  longitude: number | null;
  addressLabel: string | null;
};

export type Student = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  grade: string | null;
  section: string | null;
  status: StudentStatus;
  subscriptionType: StudentSubscriptionType;
  branchId: string;
};

export type StudentDetail = Student & {
  guardian: User | null;
  pickup: Pickup | null;
  currentRoute: { id: string; name: string; status: RouteStatus } | null;
  createdAt: string;
  updatedAt: string;
  routeStopsStale?: boolean;
};

export type StudentStats = {
  total: number;
  active: number;
  withoutRoute: number;
  homePickup: number;
  meetingPointPickup: number;
};

export type StudentTrip = {
  id: string;
  status: TripStudentStatus;
  isException: boolean;
  boardedAt: string | null;
  droppedOffAt: string | null;
  notBoardedAt: string | null;
  occurredAt?: string;
  trip: {
    id: string;
    serviceDate: string;
    direction: TripDirection;
    status: TripStatus;
    scheduledDepartureTime: string;
    routeId: string;
  };
};

export type RouteException = {
  id: string;
  studentId: string;
  overrideRouteId: string;
  overrideRoute?: { id: string; name: string } | null;
  direction: TripDirection | null;
  date: string;
  reason: string | null;
  createdAt?: string;
};

export type Parent = User & { students: Student[] };

export type UniversityStudent = {
  id: string;
  userId: string;
  institutionId: string;
  branchId: string | null;
  studentNumber: string | null;
  faculty: string | null;
  status: StudentStatus;
  user: User | null;
  createdAt: string;
  updatedAt: string;
};

export type BranchStats = {
  branchId: string;
  timezone: string;
  serviceDate: string;
  counts: { students: number; routes: number; tripsToday: number };
};

export type RouteSchedule = {
  id: string;
  routeId: string;
  direction: TripDirection;
  departureTime: string;
  daysOfWeek: number[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RouteStop = {
  id: string;
  routeId: string;
  direction: TripDirection;
  sequence: number;
  stopType: StopType;
  label: string | null;
  latitude: number;
  longitude: number;
  meetingPointId: string | null;
  meetingPoint: { id: string; name: string } | null;
  etaOffsetMinutes: number | null;
  studentIds: string[];
  students: Student[];
  createdAt: string;
  updatedAt: string;
};

export type RouteSummary = {
  id: string;
  institutionId: string;
  branchId: string;
  name: string;
  code: string | null;
  status: RouteStatus;
  originLabel: string | null;
  originLat: number;
  originLng: number;
  delayThresholdMinutes: number | null;
  defaultDriverId: string | null;
  defaultVehicleId: string | null;
  defaultAttendantId: string | null;
  defaultDriver: PersonRef | null;
  defaultVehicle: { id: string; plateNumber: string } | null;
  defaultAttendant: PersonRef | null;
  studentCount: number;
  scheduleCount: number;
  stopCount: number;
  stopsOrderStale: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RouteStudent = Student & {
  assignmentId: string;
  startedAt: string;
  guardian: User | null;
  pickup: Pickup | null;
};

export type RouteDetail = RouteSummary & {
  schedules: RouteSchedule[];
  stops: RouteStop[];
  students: RouteStudent[];
};

export type RouteStats = {
  total: number;
  active: number;
  suspended: number;
  stoppedToday: number;
  unavailable: number;
  underEdit: number;
};

export type OptimizeStopsResult = {
  direction: TripDirection;
  persisted: false;
  origin: { label: string | null; latitude: number; longitude: number };
  stops: {
    stopId: string;
    sequence: number;
    stopType: StopType;
    label: string | null;
    latitude: number;
    longitude: number;
    etaOffsetMinutes: number | null;
    address: string | null;
  }[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  current: {
    stopIds: string[];
    totalDistanceMeters: number;
    totalDurationSeconds: number;
  };
  improved: boolean;
};

export type Trip = {
  id: string;
  institutionId: string;
  branchId: string;
  routeId: string;
  scheduleId: string | null;
  direction: TripDirection;
  status: TripStatus;
  serviceDate: string;
  scheduledDepartureTime: string;
  originLabel: string | null;
  originLat: number | null;
  originLng: number | null;
  driverId: string | null;
  vehicleId: string | null;
  attendantId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  delayThresholdMinutes: number | null;
  delayMinutes: number | null;
  delayed: boolean;
  route: { id: string; name: string; status: RouteStatus } | null;
  branch: { id: string; name: string } | null;
  driver: PersonRef | null;
  vehicle: { id: string; plateNumber: string } | null;
  attendant: PersonRef | null;
  stopCount: number;
  studentCount: number;
  eventCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TripStop = {
  id: string;
  tripId: string;
  routeStopId: string | null;
  sequence: number;
  stopType: StopType;
  label: string | null;
  latitude: number;
  longitude: number;
  status: TripStopStatus;
  plannedArrivalAt: string | null;
  etaAt: string | null;
  arrivedAt: string | null;
};

export type TripStudent = {
  id: string;
  tripId: string;
  studentId: string;
  tripStopId: string | null;
  status: TripStudentStatus;
  isException: boolean;
  boardedAt: string | null;
  droppedOffAt: string | null;
  notBoardedAt: string | null;
  correctedAt: string | null;
  student: Student | null;
  stop: { id: string; sequence: number; label: string | null; stopType: StopType } | null;
};

export type TripEvent = {
  id: string;
  tripId: string;
  type: string;
  title: string | null;
  description: string | null;
  data: unknown;
  occurredAt: string;
  actor: { id: string; fullName: string } | null;
};

export type TripSummary = {
  trip: Trip;
  students: CountRecord;
  stops: CountRecord;
};

export type TripStats = {
  date: string;
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  delayed: number;
};

export type GenerationResult = {
  date: string;
  routesConsidered: number;
  tripsCreated: number;
  tripsExisting: number;
  stopsCreated: number;
  studentsCreated: number;
  exceptionsApplied: number;
};

export type LiveLocation = {
  latitude: number;
  longitude: number;
  speedKph: number | null;
  heading: number | null;
  accuracy: number | null;
  recordedAt: string;
};

export type LiveTrip = {
  id: string;
  institutionId: string;
  branchId: string;
  routeId: string;
  status: TripStatus;
  direction: TripDirection;
  delayMinutes: number | null;
  delayed: boolean;
  gpsStale: boolean;
  etaToNextStopAt: string | null;
  etaToFinishAt: string | null;
  location: LiveLocation | null;
  route: { id: string; name: string } | null;
  nextStop: { id: string; sequence: number; label: string | null; etaAt: string | null } | null;
};

export type InstitutionDashboardSummary = {
  todayTrips: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  delayed: number;
  openIncidents: number;
};

export type Incident = {
  id: string;
  tripId: string;
  type: IncidentType;
  status: IncidentStatus;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  reportedBy: { id: string; fullName: string } | null;
  resolvedBy: { id: string; fullName: string } | null;
  trip: {
    id: string;
    status: TripStatus;
    route: { id: string; name: string } | null;
    branch: { id: string; name: string } | null;
    driver: PersonRef | null;
    vehicle: { id: string; plateNumber: string } | null;
    attendant: PersonRef | null;
  } | null;
};

export type OperatedInstitutionRef = Pick<InstitutionRef, "id" | "name" | "displayName" | "operationModel">;

export type AdminTrip = Trip & { institution: OperatedInstitutionRef };

export type AdminLiveTrip = LiveTrip & {
  institution: OperatedInstitutionRef;
  driver: { id: string; fullName: string; phone: string } | null;
  vehicle: { id: string; plateNumber: string } | null;
  openIncidents: IncidentType[];
};

export type AdminIncident = Incident & { institution: OperatedInstitutionRef };

export type AdminTripDetail = {
  trip: AdminTrip;
  live: LiveTrip;
  stops: TripStop[];
  events: TripEvent[];
  incidents: Incident[];
};

export type IncidentStats = {
  openBreakdowns: number;
  openEmergencies: number;
  resolved: number;
  total: number;
};

export type Attention = {
  delayed: { id: string; routeId: string; routeName: string | null; delayMinutes: number | null }[];
  openBreakdowns: Incident[];
  openEmergencies: Incident[];
  gpsStale: { id: string; routeId: string; routeName: string | null; lastLocationAt: string | null }[];
};

export type NotificationItem = {
  id: string;
  institutionId: string;
  branchId: string | null;
  routeId: string | null;
  audience: NotificationAudience;
  origin: NotificationOrigin;
  title: string;
  body: string;
  data: unknown;
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  recipients?: {
    id: string;
    userId: string;
    status: DeliveryStatus;
    sentAt: string | null;
    user: { id: string; fullName: string; phone: string; role: Role } | null;
  }[];
};

export type AuditLog = {
  id: string;
  institutionId: string | null;
  actorUserId: string | null;
  actor: { id: string; fullName: string; role: Role } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type ResourceTrip = {
  id: string;
  serviceDate: string;
  direction: TripDirection;
  status: TripStatus;
  scheduledDepartureTime: string;
  route?: { id: string; name: string } | null;
  routeId?: string;
};

export type AdminSearchResult = {
  institutions: InstitutionRef[];
  drivers: SearchDriver[];
  vehicles: SearchVehicle[];
};

export type SearchDriver = {
  id: string;
  fullName: string;
  phone: string;
  status: ResourceStatus;
  ownerType: OwnerType;
  institutionId: string | null;
};

export type SearchVehicle = {
  id: string;
  plateNumber: string;
  vehicleType: string | null;
  status: VehicleStatus;
  ownerType: OwnerType;
  institutionId: string | null;
};

export type InstitutionSearchResult = {
  students: Student[];
  parents: { id: string; fullName: string; phone: string; branchId: string | null; status: UserStatus }[];
  routes: { id: string; name: string; code: string | null; branchId: string; status: RouteStatus }[];
  drivers: SearchDriver[];
  vehicles: SearchVehicle[];
};

export type UploadPurpose =
  | "logo"
  | "student_photo"
  | "splash_image"
  | "splash_animation"
  | "loading_animation"
  | "home_animation"
  | "success_animation"
  | "error_animation"
  | "empty_animation";

export type PresignResult = {
  purpose: UploadPurpose;
  objectKey: string;
  uploadUrl: string;
  method: "PUT";
  expiresIn: number;
  maxBytes: number;
  publicUrl: string;
};

export type CompleteUploadResult = {
  purpose: UploadPurpose;
  objectKey: string;
  url: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  contentType?: string;
};
