-- Prefer Arabic push notifications by tracking each device app language.
ALTER TABLE "UserDevice" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ar';
