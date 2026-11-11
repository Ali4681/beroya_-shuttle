ALTER TABLE "PlatformSetting" ADD COLUMN "supportWhatsappUrl" TEXT;

ALTER TABLE "PlatformSetting" ADD COLUMN "maintenanceApps" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSetting" ADD COLUMN "maintenanceDashboard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSetting" ADD COLUMN "maintenanceMessageAr" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "maintenanceMessageEn" TEXT;

ALTER TABLE "PlatformSetting" ADD COLUMN "announcementEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSetting" ADD COLUMN "announcementTitleAr" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "announcementBodyAr" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "announcementTitleEn" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN "announcementBodyEn" TEXT;

ALTER TABLE "PlatformSetting" ADD COLUMN "fcmParents" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSetting" ADD COLUMN "fcmUniversity" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSetting" ADD COLUMN "fcmDrivers" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSetting" ADD COLUMN "fcmAttendants" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSetting" ADD COLUMN "fcmAdmins" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "PlatformSetting" ADD COLUMN "templateDelayTitleAr" TEXT NOT NULL DEFAULT 'الرحلة متأخرة';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateDelayBodyAr" TEXT NOT NULL DEFAULT 'هذه الرحلة متأخرة حوالي {minutes} دقيقة عن الجدول.';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateDelayTitleEn" TEXT NOT NULL DEFAULT 'Trip delayed';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateDelayBodyEn" TEXT NOT NULL DEFAULT 'This trip is about {minutes} minutes behind schedule.';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateEmergencyTitleAr" TEXT NOT NULL DEFAULT 'طوارئ في رحلة';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateEmergencyBodyAr" TEXT NOT NULL DEFAULT 'تم الضغط على زر الطوارئ.';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateEmergencyTitleEn" TEXT NOT NULL DEFAULT 'Emergency on a trip';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateEmergencyBodyEn" TEXT NOT NULL DEFAULT 'An emergency button was pressed.';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateArrivalTitleAr" TEXT NOT NULL DEFAULT 'الحافلة تقترب';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateArrivalBodyAr" TEXT NOT NULL DEFAULT 'حافلة {studentName} على بعد حوالي {minutes} دقيقة.';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateArrivalTitleEn" TEXT NOT NULL DEFAULT 'Bus is approaching';
ALTER TABLE "PlatformSetting" ADD COLUMN "templateArrivalBodyEn" TEXT NOT NULL DEFAULT '{studentName}''s bus is about {minutes} minutes away.';
