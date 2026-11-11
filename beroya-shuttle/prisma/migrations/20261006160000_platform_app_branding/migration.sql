CREATE TYPE "AppBrandingApp" AS ENUM ('PASSENGER', 'CREW');

CREATE TABLE "PlatformAppBranding" (
    "id" TEXT NOT NULL,
    "appKey" "AppBrandingApp" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "published" JSONB NOT NULL,
    "draft" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAppBranding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAppBranding_appKey_key" ON "PlatformAppBranding"("appKey");

INSERT INTO "PlatformAppBranding" ("id", "appKey", "version", "published", "draft")
VALUES
  (
    'app-branding-passenger',
    'PASSENGER',
    0,
    '{"logoUrl":null,"primaryColor":"#313193","secondaryColor":"#25C5D1","backgroundColor":"#FFFFFF","splashImageUrl":null,"splashAnimationUrl":null,"splashAnimationType":"none","splashDuration":2500,"splashAnimationEnabled":false,"loadingAnimationUrl":null,"homeAnimationUrl":null,"successAnimationUrl":null,"errorAnimationUrl":null,"emptyStateAnimationUrl":null,"selectedAndroidIcon":"icon_01","selectedIosIcon":"icon_01"}'::jsonb,
    '{"logoUrl":null,"primaryColor":"#313193","secondaryColor":"#25C5D1","backgroundColor":"#FFFFFF","splashImageUrl":null,"splashAnimationUrl":null,"splashAnimationType":"none","splashDuration":2500,"splashAnimationEnabled":false,"loadingAnimationUrl":null,"homeAnimationUrl":null,"successAnimationUrl":null,"errorAnimationUrl":null,"emptyStateAnimationUrl":null,"selectedAndroidIcon":"icon_01","selectedIosIcon":"icon_01"}'::jsonb
  ),
  (
    'app-branding-crew',
    'CREW',
    0,
    '{"logoUrl":null,"primaryColor":"#313193","secondaryColor":"#25C5D1","backgroundColor":"#FFFFFF","splashImageUrl":null,"splashAnimationUrl":null,"splashAnimationType":"none","splashDuration":2500,"splashAnimationEnabled":false,"loadingAnimationUrl":null,"homeAnimationUrl":null,"successAnimationUrl":null,"errorAnimationUrl":null,"emptyStateAnimationUrl":null,"selectedAndroidIcon":"icon_01","selectedIosIcon":"icon_01"}'::jsonb,
    '{"logoUrl":null,"primaryColor":"#313193","secondaryColor":"#25C5D1","backgroundColor":"#FFFFFF","splashImageUrl":null,"splashAnimationUrl":null,"splashAnimationType":"none","splashDuration":2500,"splashAnimationEnabled":false,"loadingAnimationUrl":null,"homeAnimationUrl":null,"successAnimationUrl":null,"errorAnimationUrl":null,"emptyStateAnimationUrl":null,"selectedAndroidIcon":"icon_01","selectedIosIcon":"icon_01"}'::jsonb
  )
ON CONFLICT ("appKey") DO NOTHING;
