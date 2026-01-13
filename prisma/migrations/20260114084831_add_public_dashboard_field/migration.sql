-- AlterTable: Add publicDashboard field to Chatbot
ALTER TABLE "Chatbot" ADD COLUMN     "publicDashboard" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: Index for publicDashboard
CREATE INDEX "Chatbot_publicDashboard_idx" ON "Chatbot"("publicDashboard");

-- Data migration: Ensure all conversations have a chatbotVersionId
-- Assign conversations without a version to their chatbot's current version
UPDATE "Conversation" c
SET "chatbotVersionId" = (
  SELECT "currentVersionId" 
  FROM "Chatbot" 
  WHERE "Chatbot"."id" = c."chatbotId"
)
WHERE c."chatbotVersionId" IS NULL;

-- Fallback: If chatbot has no currentVersionId, assign to first version
UPDATE "Conversation" c
SET "chatbotVersionId" = (
  SELECT cv."id"
  FROM "Chatbot_Version" cv
  WHERE cv."chatbotId" = c."chatbotId"
  ORDER BY cv."versionNumber" ASC
  LIMIT 1
)
WHERE c."chatbotVersionId" IS NULL;

-- AlterTable: Make chatbotVersionId required (NOT NULL)
-- This will fail if any conversations still have NULL chatbotVersionId
ALTER TABLE "Conversation" ALTER COLUMN "chatbotVersionId" SET NOT NULL;

