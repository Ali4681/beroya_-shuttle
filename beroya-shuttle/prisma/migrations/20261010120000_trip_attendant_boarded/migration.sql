-- AlterEnum
ALTER TYPE "TripEventType" ADD VALUE 'ATTENDANT_BOARDED';
ALTER TYPE "TripEventType" ADD VALUE 'ATTENDANT_BOARDING_CLEARED';

-- AlterTable
ALTER TABLE "ShuttleTrip" ADD COLUMN "attendantBoarded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShuttleTrip" ADD COLUMN "attendantBoardedAt" TIMESTAMP(3);
ALTER TABLE "ShuttleTrip" ADD COLUMN "attendantBoardedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "ShuttleTrip" ADD CONSTRAINT "ShuttleTrip_attendantBoardedByUserId_fkey" FOREIGN KEY ("attendantBoardedByUserId") REFERENCES "ShuttleUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
