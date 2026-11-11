ALTER TABLE "ShuttleUser" ADD COLUMN "email" TEXT;
ALTER TABLE "ShuttleUser" ADD COLUMN "passwordHash" TEXT;

CREATE UNIQUE INDEX "ShuttleUser_email_key" ON "ShuttleUser"("email");
