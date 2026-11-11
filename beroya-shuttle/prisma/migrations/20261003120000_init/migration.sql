-- CreateEnum
CREATE TYPE "ShuttleRole" AS ENUM ('BEROYA_ADMIN', 'INSTITUTION_ADMIN', 'PARENT', 'UNIVERSITY_STUDENT', 'COMPANY_EMPLOYEE', 'DRIVER', 'ATTENDANT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('SCHOOL', 'UNIVERSITY', 'COMPANY');

-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OperationModel" AS ENUM ('BEROYA_OPERATED', 'INSTITUTION_OPERATED', 'HYBRID');

-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('BEROYA', 'INSTITUTION');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'UNDER_MAINTENANCE');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'STOPPED_TODAY', 'TEMPORARILY_UNAVAILABLE', 'UNDER_EDIT');

-- CreateEnum
CREATE TYPE "TripDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripStudentStatus" AS ENUM ('PENDING', 'BOARDED', 'NOT_BOARDED', 'DROPPED_OFF');

-- CreateEnum
CREATE TYPE "TripStopStatus" AS ENUM ('PENDING', 'ARRIVED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PickupType" AS ENUM ('HOME', 'MEETING_POINT');

-- CreateEnum
CREATE TYPE "StopType" AS ENUM ('STUDENT_HOME', 'MEETING_POINT', 'INSTITUTION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StudentSubscriptionType" AS ENUM ('ROUND_TRIP', 'OUTBOUND_ONLY', 'INBOUND_ONLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'TERM');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('BREAKDOWN', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TripAssignmentField" AS ENUM ('DRIVER', 'VEHICLE', 'ATTENDANT');

-- CreateEnum
CREATE TYPE "TripEventType" AS ENUM ('TRIP_STARTED', 'TRIP_COMPLETED', 'TRIP_CANCELLED', 'STOP_ARRIVED', 'STUDENT_BOARDED', 'STUDENT_NOT_BOARDED', 'STUDENT_DROPPED_OFF', 'STUDENT_STATUS_CORRECTED', 'DELAY_DETECTED', 'BREAKDOWN_REPORTED', 'EMERGENCY_TRIGGERED', 'DRIVER_CHANGED', 'VEHICLE_CHANGED', 'ATTENDANT_CHANGED', 'ORIGIN_OVERRIDDEN', 'TIME_OVERRIDDEN', 'TRACKING_LOST', 'TRACKING_RESUMED', 'INCIDENT_RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('ALL_PARENTS', 'ROUTE_PARENTS', 'ALL_UNIVERSITY_STUDENTS', 'ROUTE_UNIVERSITY_STUDENTS');

-- CreateEnum
CREATE TYPE "NotificationOrigin" AS ENUM ('MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "TripAlertType" AS ENUM ('ARRIVAL_SOON', 'DELAY');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateTable
CREATE TABLE "ShuttleUser" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "ShuttleRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "institutionId" TEXT,
    "branchId" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ShuttleUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "appVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "type" "InstitutionType" NOT NULL,
    "operationModel" "OperationModel" NOT NULL DEFAULT 'INSTITUTION_OPERATED',
    "status" "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT,
    "primaryAdminUserId" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionSettings" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Damascus',
    "defaultDelayThresholdMinutes" INTEGER NOT NULL DEFAULT 10,
    "defaultParentArrivalAlertMinutes" INTEGER NOT NULL DEFAULT 10,
    "gpsStaleAfterSeconds" INTEGER NOT NULL DEFAULT 120,
    "locationPingIntervalSeconds" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionBranding" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "useInstitutionIdentity" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "welcomeMessage" TEXT,
    "supportPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionBranch" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "InstitutionBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionSubscription" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "agreedAmount" DECIMAL(12,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "activatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT,
    "ownerType" "OwnerType" NOT NULL,
    "nationalId" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleVehicle" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT,
    "ownerType" "OwnerType" NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "vehicleType" TEXT,
    "capacity" INTEGER,
    "licenseExpiry" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ShuttleVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendantProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "nationalId" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AttendantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolStudent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "grade" TEXT,
    "section" TEXT,
    "guardianUserId" TEXT NOT NULL,
    "subscriptionType" "StudentSubscriptionType" NOT NULL DEFAULT 'ROUND_TRIP',
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPickupConfig" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "pickupType" "PickupType" NOT NULL,
    "meetingPointId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "addressLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPickupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniversityStudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT,
    "studentNumber" TEXT,
    "faculty" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "UniversityStudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentArrivalPreference" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "minutesBefore" INTEGER NOT NULL DEFAULT 10,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentArrivalPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingPoint" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "addressLabel" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MeetingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleRoute" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" "RouteStatus" NOT NULL DEFAULT 'ACTIVE',
    "originLabel" TEXT,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "delayThresholdMinutes" INTEGER,
    "defaultDriverId" TEXT,
    "defaultVehicleId" TEXT,
    "defaultAttendantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ShuttleRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteSchedule" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "direction" "TripDirection" NOT NULL,
    "departureTime" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "direction" "TripDirection" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stopType" "StopType" NOT NULL,
    "label" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "meetingPointId" TEXT,
    "etaOffsetMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStopStudent" (
    "id" TEXT NOT NULL,
    "routeStopId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteStopStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRouteAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRouteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRouteException" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "overrideRouteId" TEXT NOT NULL,
    "direction" "TripDirection",
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRouteException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleTrip" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "direction" "TripDirection" NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'SCHEDULED',
    "serviceDate" DATE NOT NULL,
    "scheduledDepartureTime" TEXT NOT NULL,
    "originLabel" TEXT,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "attendantId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "delayThresholdMinutes" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "delayDetectedAt" TIMESTAMP(3),
    "delayAlertSentAt" TIMESTAMP(3),
    "lastLocationLat" DOUBLE PRECISION,
    "lastLocationLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "etaToNextStopAt" TIMESTAMP(3),
    "etaToFinishAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShuttleTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStop" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "routeStopId" TEXT,
    "sequence" INTEGER NOT NULL,
    "stopType" "StopType" NOT NULL,
    "label" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" "TripStopStatus" NOT NULL DEFAULT 'PENDING',
    "plannedArrivalAt" TIMESTAMP(3),
    "etaAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStudent" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tripStopId" TEXT,
    "status" "TripStudentStatus" NOT NULL DEFAULT 'PENDING',
    "isException" BOOLEAN NOT NULL DEFAULT false,
    "boardedAt" TIMESTAMP(3),
    "droppedOffAt" TIMESTAMP(3),
    "notBoardedAt" TIMESTAMP(3),
    "markedByUserId" TEXT,
    "correctedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripAssignmentHistory" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "field" "TripAssignmentField" NOT NULL,
    "previousId" TEXT,
    "previousLabel" TEXT,
    "newId" TEXT,
    "newLabel" TEXT,
    "reason" TEXT,
    "incidentId" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripLocationPing" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speedKph" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripLocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripIncident" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "reportedByUserId" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripEvent" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "type" "TripEventType" NOT NULL,
    "actorUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleNotification" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT,
    "routeId" TEXT,
    "audience" "NotificationAudience" NOT NULL,
    "origin" "NotificationOrigin" NOT NULL DEFAULT 'MANUAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "recipientsCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "sentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripAlertDelivery" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT,
    "type" "TripAlertType" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripAlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleAuditLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShuttleUser_institutionId_role_status_idx" ON "ShuttleUser"("institutionId", "role", "status");

-- CreateIndex
CREATE INDEX "ShuttleUser_phone_idx" ON "ShuttleUser"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleUser_phone_institutionId_key" ON "ShuttleUser"("phone", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_refreshTokenHash_key" ON "UserSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_revokedAt_idx" ON "UserSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "UserDevice_fcmToken_idx" ON "UserDevice"("fcmToken");

-- CreateIndex
CREATE UNIQUE INDEX "UserDevice_userId_deviceId_key" ON "UserDevice"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "Institution_type_status_idx" ON "Institution"("type", "status");

-- CreateIndex
CREATE INDEX "Institution_operationModel_idx" ON "Institution"("operationModel");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionSettings_institutionId_key" ON "InstitutionSettings"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionBranding_institutionId_key" ON "InstitutionBranding"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionBranch_institutionId_status_idx" ON "InstitutionBranch"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionBranch_institutionId_name_key" ON "InstitutionBranch"("institutionId", "name");

-- CreateIndex
CREATE INDEX "InstitutionSubscription_institutionId_status_idx" ON "InstitutionSubscription"("institutionId", "status");

-- CreateIndex
CREATE INDEX "InstitutionSubscription_status_endsAt_idx" ON "InstitutionSubscription"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "DriverProfile"("userId");

-- CreateIndex
CREATE INDEX "DriverProfile_institutionId_status_idx" ON "DriverProfile"("institutionId", "status");

-- CreateIndex
CREATE INDEX "DriverProfile_ownerType_status_idx" ON "DriverProfile"("ownerType", "status");

-- CreateIndex
CREATE INDEX "ShuttleVehicle_institutionId_status_idx" ON "ShuttleVehicle"("institutionId", "status");

-- CreateIndex
CREATE INDEX "ShuttleVehicle_ownerType_status_idx" ON "ShuttleVehicle"("ownerType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleVehicle_plateNumber_key" ON "ShuttleVehicle"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AttendantProfile_userId_key" ON "AttendantProfile"("userId");

-- CreateIndex
CREATE INDEX "AttendantProfile_institutionId_status_idx" ON "AttendantProfile"("institutionId", "status");

-- CreateIndex
CREATE INDEX "SchoolStudent_institutionId_branchId_status_idx" ON "SchoolStudent"("institutionId", "branchId", "status");

-- CreateIndex
CREATE INDEX "SchoolStudent_guardianUserId_idx" ON "SchoolStudent"("guardianUserId");

-- CreateIndex
CREATE INDEX "SchoolStudent_institutionId_fullName_idx" ON "SchoolStudent"("institutionId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPickupConfig_studentId_key" ON "StudentPickupConfig"("studentId");

-- CreateIndex
CREATE INDEX "StudentPickupConfig_meetingPointId_idx" ON "StudentPickupConfig"("meetingPointId");

-- CreateIndex
CREATE UNIQUE INDEX "UniversityStudentProfile_userId_key" ON "UniversityStudentProfile"("userId");

-- CreateIndex
CREATE INDEX "UniversityStudentProfile_institutionId_status_idx" ON "UniversityStudentProfile"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UniversityStudentProfile_institutionId_studentNumber_key" ON "UniversityStudentProfile"("institutionId", "studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ParentArrivalPreference_parentUserId_studentId_key" ON "ParentArrivalPreference"("parentUserId", "studentId");

-- CreateIndex
CREATE INDEX "MeetingPoint_institutionId_status_idx" ON "MeetingPoint"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleRoute_defaultAttendantId_key" ON "ShuttleRoute"("defaultAttendantId");

-- CreateIndex
CREATE INDEX "ShuttleRoute_institutionId_branchId_status_idx" ON "ShuttleRoute"("institutionId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleRoute_institutionId_name_key" ON "ShuttleRoute"("institutionId", "name");

-- CreateIndex
CREATE INDEX "RouteSchedule_routeId_isActive_idx" ON "RouteSchedule"("routeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RouteSchedule_routeId_direction_departureTime_key" ON "RouteSchedule"("routeId", "direction", "departureTime");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_direction_idx" ON "RouteStop"("routeId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_direction_sequence_key" ON "RouteStop"("routeId", "direction", "sequence");

-- CreateIndex
CREATE INDEX "RouteStopStudent_studentId_idx" ON "RouteStopStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStopStudent_routeStopId_studentId_key" ON "RouteStopStudent"("routeStopId", "studentId");

-- CreateIndex
CREATE INDEX "StudentRouteAssignment_studentId_isActive_idx" ON "StudentRouteAssignment"("studentId", "isActive");

-- CreateIndex
CREATE INDEX "StudentRouteAssignment_routeId_isActive_idx" ON "StudentRouteAssignment"("routeId", "isActive");

-- CreateIndex
CREATE INDEX "StudentRouteException_date_idx" ON "StudentRouteException"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRouteException_studentId_date_direction_key" ON "StudentRouteException"("studentId", "date", "direction");

-- CreateIndex
CREATE INDEX "ShuttleTrip_institutionId_serviceDate_status_idx" ON "ShuttleTrip"("institutionId", "serviceDate", "status");

-- CreateIndex
CREATE INDEX "ShuttleTrip_branchId_serviceDate_idx" ON "ShuttleTrip"("branchId", "serviceDate");

-- CreateIndex
CREATE INDEX "ShuttleTrip_driverId_serviceDate_idx" ON "ShuttleTrip"("driverId", "serviceDate");

-- CreateIndex
CREATE INDEX "ShuttleTrip_status_serviceDate_idx" ON "ShuttleTrip"("status", "serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleTrip_routeId_serviceDate_direction_scheduledDepartur_key" ON "ShuttleTrip"("routeId", "serviceDate", "direction", "scheduledDepartureTime");

-- CreateIndex
CREATE INDEX "TripStop_tripId_status_idx" ON "TripStop"("tripId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TripStop_tripId_sequence_key" ON "TripStop"("tripId", "sequence");

-- CreateIndex
CREATE INDEX "TripStudent_studentId_createdAt_idx" ON "TripStudent"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "TripStudent_tripId_status_idx" ON "TripStudent"("tripId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TripStudent_tripId_studentId_key" ON "TripStudent"("tripId", "studentId");

-- CreateIndex
CREATE INDEX "TripAssignmentHistory_tripId_changedAt_idx" ON "TripAssignmentHistory"("tripId", "changedAt");

-- CreateIndex
CREATE INDEX "TripLocationPing_tripId_recordedAt_idx" ON "TripLocationPing"("tripId", "recordedAt");

-- CreateIndex
CREATE INDEX "TripIncident_tripId_status_idx" ON "TripIncident"("tripId", "status");

-- CreateIndex
CREATE INDEX "TripIncident_status_createdAt_idx" ON "TripIncident"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TripEvent_tripId_occurredAt_idx" ON "TripEvent"("tripId", "occurredAt");

-- CreateIndex
CREATE INDEX "TripEvent_type_idx" ON "TripEvent"("type");

-- CreateIndex
CREATE INDEX "ShuttleNotification_institutionId_createdAt_idx" ON "ShuttleNotification"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "ShuttleNotification_routeId_createdAt_idx" ON "ShuttleNotification"("routeId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationRecipient_userId_createdAt_idx" ON "NotificationRecipient"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_notificationId_userId_key" ON "NotificationRecipient"("notificationId", "userId");

-- CreateIndex
CREATE INDEX "TripAlertDelivery_tripId_type_idx" ON "TripAlertDelivery"("tripId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TripAlertDelivery_tripId_userId_type_studentId_key" ON "TripAlertDelivery"("tripId", "userId", "type", "studentId");

-- CreateIndex
CREATE INDEX "ShuttleAuditLog_institutionId_createdAt_idx" ON "ShuttleAuditLog"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "ShuttleAuditLog_actorUserId_createdAt_idx" ON "ShuttleAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ShuttleAuditLog_entityType_entityId_idx" ON "ShuttleAuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "ShuttleUser" ADD CONSTRAINT "ShuttleUser_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleUser" ADD CONSTRAINT "ShuttleUser_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "InstitutionBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShuttleUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShuttleUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_primaryAdminUserId_fkey" FOREIGN KEY ("primaryAdminUserId") REFERENCES "ShuttleUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionSettings" ADD CONSTRAINT "InstitutionSettings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionBranding" ADD CONSTRAINT "InstitutionBranding_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionBranch" ADD CONSTRAINT "InstitutionBranch_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionSubscription" ADD CONSTRAINT "InstitutionSubscription_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShuttleUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleVehicle" ADD CONSTRAINT "ShuttleVehicle_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendantProfile" ADD CONSTRAINT "AttendantProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShuttleUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendantProfile" ADD CONSTRAINT "AttendantProfile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudent" ADD CONSTRAINT "SchoolStudent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudent" ADD CONSTRAINT "SchoolStudent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "InstitutionBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStudent" ADD CONSTRAINT "SchoolStudent_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "ShuttleUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPickupConfig" ADD CONSTRAINT "StudentPickupConfig_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPickupConfig" ADD CONSTRAINT "StudentPickupConfig_meetingPointId_fkey" FOREIGN KEY ("meetingPointId") REFERENCES "MeetingPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversityStudentProfile" ADD CONSTRAINT "UniversityStudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShuttleUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversityStudentProfile" ADD CONSTRAINT "UniversityStudentProfile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversityStudentProfile" ADD CONSTRAINT "UniversityStudentProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "InstitutionBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentArrivalPreference" ADD CONSTRAINT "ParentArrivalPreference_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "ShuttleUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentArrivalPreference" ADD CONSTRAINT "ParentArrivalPreference_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingPoint" ADD CONSTRAINT "MeetingPoint_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingPoint" ADD CONSTRAINT "MeetingPoint_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "InstitutionBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleRoute" ADD CONSTRAINT "ShuttleRoute_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleRoute" ADD CONSTRAINT "ShuttleRoute_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "InstitutionBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleRoute" ADD CONSTRAINT "ShuttleRoute_defaultDriverId_fkey" FOREIGN KEY ("defaultDriverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleRoute" ADD CONSTRAINT "ShuttleRoute_defaultVehicleId_fkey" FOREIGN KEY ("defaultVehicleId") REFERENCES "ShuttleVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleRoute" ADD CONSTRAINT "ShuttleRoute_defaultAttendantId_fkey" FOREIGN KEY ("defaultAttendantId") REFERENCES "AttendantProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteSchedule" ADD CONSTRAINT "RouteSchedule_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ShuttleRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ShuttleRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_meetingPointId_fkey" FOREIGN KEY ("meetingPointId") REFERENCES "MeetingPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStopStudent" ADD CONSTRAINT "RouteStopStudent_routeStopId_fkey" FOREIGN KEY ("routeStopId") REFERENCES "RouteStop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStopStudent" ADD CONSTRAINT "RouteStopStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRouteAssignment" ADD CONSTRAINT "StudentRouteAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRouteAssignment" ADD CONSTRAINT "StudentRouteAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ShuttleRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRouteException" ADD CONSTRAINT "StudentRouteException_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRouteException" ADD CONSTRAINT "StudentRouteException_overrideRouteId_fkey" FOREIGN KEY ("overrideRouteId") REFERENCES "ShuttleRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRouteException" ADD CONSTRAINT "StudentRouteException_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "ShuttleUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleTrip" ADD CONSTRAINT "ShuttleTrip_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleTrip" ADD CONSTRAINT "ShuttleTrip_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "InstitutionBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleTrip" ADD CONSTRAINT "ShuttleTrip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ShuttleRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleTrip" ADD CONSTRAINT "ShuttleTrip_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RouteSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleTrip" ADD CONSTRAINT "ShuttleTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleTrip" ADD CONSTRAINT "ShuttleTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "ShuttleVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleTrip" ADD CONSTRAINT "ShuttleTrip_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "AttendantProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "ShuttleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_routeStopId_fkey" FOREIGN KEY ("routeStopId") REFERENCES "RouteStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStudent" ADD CONSTRAINT "TripStudent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "ShuttleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStudent" ADD CONSTRAINT "TripStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStudent" ADD CONSTRAINT "TripStudent_tripStopId_fkey" FOREIGN KEY ("tripStopId") REFERENCES "TripStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStudent" ADD CONSTRAINT "TripStudent_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "ShuttleUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAssignmentHistory" ADD CONSTRAINT "TripAssignmentHistory_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "ShuttleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAssignmentHistory" ADD CONSTRAINT "TripAssignmentHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "ShuttleUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAssignmentHistory" ADD CONSTRAINT "TripAssignmentHistory_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "TripIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripLocationPing" ADD CONSTRAINT "TripLocationPing_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "ShuttleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripIncident" ADD CONSTRAINT "TripIncident_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "ShuttleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripIncident" ADD CONSTRAINT "TripIncident_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "ShuttleUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripIncident" ADD CONSTRAINT "TripIncident_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "ShuttleUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripEvent" ADD CONSTRAINT "TripEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "ShuttleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripEvent" ADD CONSTRAINT "TripEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "ShuttleUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleNotification" ADD CONSTRAINT "ShuttleNotification_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleNotification" ADD CONSTRAINT "ShuttleNotification_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "InstitutionBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleNotification" ADD CONSTRAINT "ShuttleNotification_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ShuttleRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleNotification" ADD CONSTRAINT "ShuttleNotification_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "ShuttleUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "ShuttleNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShuttleUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAlertDelivery" ADD CONSTRAINT "TripAlertDelivery_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "ShuttleTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAlertDelivery" ADD CONSTRAINT "TripAlertDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ShuttleUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleAuditLog" ADD CONSTRAINT "ShuttleAuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleAuditLog" ADD CONSTRAINT "ShuttleAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "ShuttleUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

