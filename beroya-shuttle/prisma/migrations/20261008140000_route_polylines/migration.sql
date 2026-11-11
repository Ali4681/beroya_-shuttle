-- AlterTable
ALTER TABLE "ShuttleRoute" ADD COLUMN "polylineOutbound" TEXT;
ALTER TABLE "ShuttleRoute" ADD COLUMN "polylineInbound" TEXT;
ALTER TABLE "ShuttleRoute" ADD COLUMN "polylinePrecision" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "ShuttleRoute" ADD COLUMN "polylineUpdatedAt" TIMESTAMP(3);
