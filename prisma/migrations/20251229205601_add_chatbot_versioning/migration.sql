-- CreateTable
CREATE TABLE "Chatbot_Version" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "pineconeNs" TEXT NOT NULL,
    "vectorNamespace" TEXT NOT NULL,
    "configJson" JSONB,
    "ragSettingsJson" JSONB,
    "ingestionRunIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "type" "ChatbotType" NOT NULL,
    "notes" TEXT,
    "changelog" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chatbot_Version_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Chatbot" ADD COLUMN     "systemPrompt" TEXT,
ADD COLUMN     "modelProvider" TEXT,
ADD COLUMN     "modelName" TEXT,
ADD COLUMN     "pineconeNs" TEXT,
ADD COLUMN     "vectorNamespace" TEXT,
ADD COLUMN     "configJson" JSONB,
ADD COLUMN     "ragSettingsJson" JSONB,
ADD COLUMN     "ingestionRunIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "currentVersionId" TEXT;

-- AlterTable
-- Add chatbotVersionId as nullable first (will be populated by data migration script)
ALTER TABLE "Conversation" ADD COLUMN     "chatbotVersionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Chatbot_Version_chatbotId_versionNumber_key" ON "Chatbot_Version"("chatbotId", "versionNumber");

-- CreateIndex
CREATE INDEX "Chatbot_Version_chatbotId_idx" ON "Chatbot_Version"("chatbotId");

-- CreateIndex
CREATE INDEX "Chatbot_Version_activatedAt_idx" ON "Chatbot_Version"("activatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Chatbot_currentVersionId_key" ON "Chatbot"("currentVersionId");

-- CreateIndex
CREATE INDEX "Conversation_chatbotVersionId_idx" ON "Conversation"("chatbotVersionId");

-- AddForeignKey
ALTER TABLE "Chatbot_Version" ADD CONSTRAINT "Chatbot_Version_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chatbot_Version" ADD CONSTRAINT "Chatbot_Version_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chatbot" ADD CONSTRAINT "Chatbot_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "Chatbot_Version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_chatbotVersionId_fkey" FOREIGN KEY ("chatbotVersionId") REFERENCES "Chatbot_Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
