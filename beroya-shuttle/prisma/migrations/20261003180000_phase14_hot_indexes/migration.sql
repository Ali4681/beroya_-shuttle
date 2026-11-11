-- Phase 14: indexes for heavy list/cleanup queries
CREATE INDEX IF NOT EXISTS "UserSession_expiresAt_idx"
  ON "UserSession" ("expiresAt");

CREATE INDEX IF NOT EXISTS "SchoolStudent_institutionId_archivedAt_idx"
  ON "SchoolStudent" ("institutionId", "archivedAt");

CREATE INDEX IF NOT EXISTS "ShuttleRoute_status_idx"
  ON "ShuttleRoute" ("status");

CREATE INDEX IF NOT EXISTS "ShuttleTrip_institutionId_branchId_serviceDate_idx"
  ON "ShuttleTrip" ("institutionId", "branchId", "serviceDate");

CREATE INDEX IF NOT EXISTS "TripLocationPing_recordedAt_idx"
  ON "TripLocationPing" ("recordedAt");

CREATE INDEX IF NOT EXISTS "ShuttleNotification_institutionId_branchId_createdAt_idx"
  ON "ShuttleNotification" ("institutionId", "branchId", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationRecipient_userId_status_idx"
  ON "NotificationRecipient" ("userId", "status");
