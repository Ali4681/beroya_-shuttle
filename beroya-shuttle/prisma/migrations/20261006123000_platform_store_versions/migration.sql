ALTER TABLE "PlatformSetting" ADD COLUMN "driverIosMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "driverIosLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "driverAndroidMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "driverAndroidLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';

ALTER TABLE "PlatformSetting" ADD COLUMN "attendantIosMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "attendantIosLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "attendantAndroidMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "attendantAndroidLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';

ALTER TABLE "PlatformSetting" ADD COLUMN "parentIosMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "parentIosLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "parentAndroidMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "parentAndroidLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';

ALTER TABLE "PlatformSetting" ADD COLUMN "universityIosMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "universityIosLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "universityAndroidMinVersion" TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE "PlatformSetting" ADD COLUMN "universityAndroidLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';

UPDATE "PlatformSetting"
SET
  "driverIosMinVersion" = "driverMinVersion",
  "driverIosLatestVersion" = "driverLatestVersion",
  "driverAndroidMinVersion" = "driverMinVersion",
  "driverAndroidLatestVersion" = "driverLatestVersion",
  "attendantIosMinVersion" = "attendantMinVersion",
  "attendantIosLatestVersion" = "attendantLatestVersion",
  "attendantAndroidMinVersion" = "attendantMinVersion",
  "attendantAndroidLatestVersion" = "attendantLatestVersion",
  "parentIosMinVersion" = "parentMinVersion",
  "parentIosLatestVersion" = "parentLatestVersion",
  "parentAndroidMinVersion" = "parentMinVersion",
  "parentAndroidLatestVersion" = "parentLatestVersion",
  "universityIosMinVersion" = "universityMinVersion",
  "universityIosLatestVersion" = "universityLatestVersion",
  "universityAndroidMinVersion" = "universityMinVersion",
  "universityAndroidLatestVersion" = "universityLatestVersion";

ALTER TABLE "PlatformSetting" DROP COLUMN "driverMinVersion";
ALTER TABLE "PlatformSetting" DROP COLUMN "driverLatestVersion";
ALTER TABLE "PlatformSetting" DROP COLUMN "attendantMinVersion";
ALTER TABLE "PlatformSetting" DROP COLUMN "attendantLatestVersion";
ALTER TABLE "PlatformSetting" DROP COLUMN "parentMinVersion";
ALTER TABLE "PlatformSetting" DROP COLUMN "parentLatestVersion";
ALTER TABLE "PlatformSetting" DROP COLUMN "universityMinVersion";
ALTER TABLE "PlatformSetting" DROP COLUMN "universityLatestVersion";
