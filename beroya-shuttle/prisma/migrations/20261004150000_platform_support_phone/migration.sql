CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "supportPhone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);
