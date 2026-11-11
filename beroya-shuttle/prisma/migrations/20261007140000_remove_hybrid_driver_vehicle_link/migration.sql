-- Migrate HYBRID institutions to BEROYA_OPERATED, then drop HYBRID from OperationModel.
UPDATE "Institution" SET "operationModel" = 'BEROYA_OPERATED' WHERE "operationModel" = 'HYBRID';

CREATE TYPE "OperationModel_new" AS ENUM ('BEROYA_OPERATED', 'INSTITUTION_OPERATED');

ALTER TABLE "Institution"
  ALTER COLUMN "operationModel" DROP DEFAULT,
  ALTER COLUMN "operationModel" TYPE "OperationModel_new"
    USING ("operationModel"::text::"OperationModel_new"),
  ALTER COLUMN "operationModel" SET DEFAULT 'INSTITUTION_OPERATED'::"OperationModel_new";

DROP TYPE "OperationModel";
ALTER TYPE "OperationModel_new" RENAME TO "OperationModel";

-- Driver-owned vehicles + primary vehicle link.
ALTER TYPE "OwnerType" ADD VALUE 'DRIVER';

ALTER TABLE "ShuttleVehicle" ADD COLUMN "ownerDriverId" TEXT;
ALTER TABLE "DriverProfile" ADD COLUMN "primaryVehicleId" TEXT;

CREATE UNIQUE INDEX "DriverProfile_primaryVehicleId_key" ON "DriverProfile"("primaryVehicleId");
CREATE INDEX "ShuttleVehicle_ownerDriverId_idx" ON "ShuttleVehicle"("ownerDriverId");

ALTER TABLE "ShuttleVehicle"
  ADD CONSTRAINT "ShuttleVehicle_ownerDriverId_fkey"
  FOREIGN KEY ("ownerDriverId") REFERENCES "DriverProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DriverProfile"
  ADD CONSTRAINT "DriverProfile_primaryVehicleId_fkey"
  FOREIGN KEY ("primaryVehicleId") REFERENCES "ShuttleVehicle"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
