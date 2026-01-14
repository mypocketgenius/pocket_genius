-- AlterTable
ALTER TABLE "Event" ADD COLUMN "messageId" TEXT;

-- CreateIndex
CREATE INDEX "Event_messageId_idx" ON "Event"("messageId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

