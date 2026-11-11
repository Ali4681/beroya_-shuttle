-- AlterTable
ALTER TABLE "NotificationRecipient" ADD COLUMN "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "NotificationRecipient_userId_readAt_idx" ON "NotificationRecipient"("userId", "readAt");
