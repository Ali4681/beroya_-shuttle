ALTER TABLE "PlatformSetting" ADD COLUMN "gpsStaleAfterSeconds" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "PlatformSetting" ADD COLUMN "locationPingIntervalSeconds" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "PlatformSetting" ADD COLUMN "driverMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "driverLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "driverIosUrl" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "driverAndroidUrl" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "driverForceMessage" TEXT;

ALTER TABLE "PlatformSetting" ADD COLUMN "attendantMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "attendantLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "attendantIosUrl" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "attendantAndroidUrl" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "attendantForceMessage" TEXT;

ALTER TABLE "PlatformSetting" ADD COLUMN "parentMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "parentLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "parentIosUrl" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "parentAndroidUrl" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "parentForceMessage" TEXT;

ALTER TABLE "PlatformSetting" ADD COLUMN "universityMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "universityLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "universityIosUrl" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "universityAndroidUrl" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "universityForceMessage" TEXT;

INSERT INTO "PlatformSetting" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
