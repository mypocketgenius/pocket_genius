-- Baseline migration: Sync schema changes that were applied via db push
-- This migration documents changes already in the database:
-- 1. Chatbot_Source junction table (many-to-many for Source-Chatbot)
-- 2. Source attribution fields (authors, year, license, etc.)
-- 3. Conversation fields (sourceIds snapshot, suggestion pills cache)
-- 4. Chatbot fields (welcomeMessage, fallbackSuggestionPills)

-- CreateTable (Chatbot_Source - many-to-many junction)
CREATE TABLE IF NOT EXISTS "Chatbot_Source" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chatbot_Source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Chatbot_Source_chatbotId_idx" ON "Chatbot_Source"("chatbotId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Chatbot_Source_sourceId_idx" ON "Chatbot_Source"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Chatbot_Source_chatbotId_sourceId_key" ON "Chatbot_Source"("chatbotId", "sourceId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Chatbot_Source" ADD CONSTRAINT "Chatbot_Source_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Chatbot_Source" ADD CONSTRAINT "Chatbot_Source_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Source - Add attribution fields
ALTER TABLE "Source" ADD COLUMN IF NOT EXISTS "authors" TEXT;
ALTER TABLE "Source" ADD COLUMN IF NOT EXISTS "year" INTEGER;
ALTER TABLE "Source" ADD COLUMN IF NOT EXISTS "license" TEXT;
ALTER TABLE "Source" ADD COLUMN IF NOT EXISTS "licenseUrl" TEXT;
ALTER TABLE "Source" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;

-- AlterTable: Source - Remove chatbotId (now using junction table)
-- Note: Only drop if exists to make migration idempotent
DO $$ BEGIN
    ALTER TABLE "Source" DROP CONSTRAINT IF EXISTS "Source_chatbotId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE "Source" DROP COLUMN IF EXISTS "chatbotId";

-- AlterTable: Conversation - Add sourceIds snapshot and suggestion pills cache
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "sourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "suggestionPillsCache" JSONB;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "suggestionPillsCachedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "intakeCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "intakeCompletedAt" TIMESTAMP(3);

-- AlterTable: Chatbot - Add welcome message and fallback pills
ALTER TABLE "Chatbot" ADD COLUMN IF NOT EXISTS "welcomeMessage" TEXT;
ALTER TABLE "Chatbot" ADD COLUMN IF NOT EXISTS "fallbackSuggestionPills" JSONB;
