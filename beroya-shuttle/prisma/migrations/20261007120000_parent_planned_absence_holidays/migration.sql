-- CreateTable
CREATE TABLE "InstitutionHoliday" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPlannedAbsence" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPlannedAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstitutionHoliday_institutionId_date_idx" ON "InstitutionHoliday"("institutionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionHoliday_institutionId_date_key" ON "InstitutionHoliday"("institutionId", "date");

-- CreateIndex
CREATE INDEX "StudentPlannedAbsence_date_appliedAt_idx" ON "StudentPlannedAbsence"("date", "appliedAt");

-- CreateIndex
CREATE INDEX "StudentPlannedAbsence_studentId_date_idx" ON "StudentPlannedAbsence"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPlannedAbsence_studentId_date_key" ON "StudentPlannedAbsence"("studentId", "date");

-- AddForeignKey
ALTER TABLE "InstitutionHoliday" ADD CONSTRAINT "InstitutionHoliday_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlannedAbsence" ADD CONSTRAINT "StudentPlannedAbsence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SchoolStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlannedAbsence" ADD CONSTRAINT "StudentPlannedAbsence_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "ShuttleUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
