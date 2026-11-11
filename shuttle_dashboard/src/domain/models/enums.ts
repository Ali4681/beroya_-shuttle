export const ROLES = [
  "BEROYA_ADMIN",
  "INSTITUTION_ADMIN",
  "PARENT",
  "UNIVERSITY_STUDENT",
  "COMPANY_EMPLOYEE",
  "DRIVER",
  "ATTENDANT",
] as const;
export type Role = (typeof ROLES)[number];

export const INSTITUTION_TYPES = ["SCHOOL", "UNIVERSITY", "COMPANY"] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const INSTITUTION_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type InstitutionStatus = (typeof INSTITUTION_STATUSES)[number];

export const OPERATION_MODELS = [
  "BEROYA_OPERATED",
  "INSTITUTION_OPERATED",
] as const;
export type OperationModel = (typeof OPERATION_MODELS)[number];

export const OWNER_TYPES = ["BEROYA", "INSTITUTION", "DRIVER"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const FLEET_OWNER_TYPES = ["BEROYA", "DRIVER"] as const;
export type FleetOwnerType = (typeof FLEET_OWNER_TYPES)[number];

export const RESOURCE_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export const VEHICLE_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "UNDER_MAINTENANCE",
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export type UserStatus = "ACTIVE" | "SUSPENDED";

export const ROUTE_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "STOPPED_TODAY",
  "TEMPORARILY_UNAVAILABLE",
  "UNDER_EDIT",
] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const TRIP_DIRECTIONS = ["OUTBOUND", "INBOUND"] as const;
export type TripDirection = (typeof TRIP_DIRECTIONS)[number];

export const TRIP_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_STUDENT_STATUSES = [
  "PENDING",
  "BOARDED",
  "NOT_BOARDED",
  "DROPPED_OFF",
] as const;
export type TripStudentStatus = (typeof TRIP_STUDENT_STATUSES)[number];

export type TripStopStatus = "PENDING" | "ARRIVED" | "SKIPPED";

export const PICKUP_TYPES = ["HOME", "MEETING_POINT"] as const;
export type PickupType = (typeof PICKUP_TYPES)[number];

export type StopType = "STUDENT_HOME" | "MEETING_POINT" | "INSTITUTION" | "CUSTOM";

export const STUDENT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const STUDENT_SUBSCRIPTION_TYPES = [
  "ROUND_TRIP",
  "OUTBOUND_ONLY",
  "INBOUND_ONLY",
] as const;
export type StudentSubscriptionType = (typeof STUDENT_SUBSCRIPTION_TYPES)[number];

export const SUBSCRIPTION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_PERIODS = ["MONTHLY", "TERM"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const INCIDENT_TYPES = ["BREAKDOWN", "EMERGENCY"] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_STATUSES = ["OPEN", "RESOLVED"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const NOTIFICATION_AUDIENCES = [
  "ALL_PARENTS",
  "ROUTE_PARENTS",
  "ALL_UNIVERSITY_STUDENTS",
  "ROUTE_UNIVERSITY_STUDENTS",
] as const;
export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number];

export type NotificationOrigin = "MANUAL" | "SYSTEM";
export type DeliveryStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED";

export const ROUTE_AUDIENCES: NotificationAudience[] = [
  "ROUTE_PARENTS",
  "ROUTE_UNIVERSITY_STUDENTS",
];
