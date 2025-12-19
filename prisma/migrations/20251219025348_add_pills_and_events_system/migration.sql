-- CreateTable
CREATE TABLE "Pill" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT,
    "pillType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prefillText" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pill_Usage" (
    "id" TEXT NOT NULL,
    "pillId" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT,
    "chatbotId" TEXT NOT NULL,
    "sourceChunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prefillText" TEXT NOT NULL,
    "sentText" TEXT NOT NULL,
    "wasModified" BOOLEAN NOT NULL DEFAULT false,
    "pairedWithPillId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pill_Usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "chunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "chunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation_Feedback" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT,
    "rating" INTEGER,
    "userGoal" TEXT,
    "goalAchieved" TEXT,
    "stillNeed" TEXT,
    "timeSaved" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chatbot_Ratings_Aggregate" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "averageRating" DECIMAL(3,2) NOT NULL,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "ratingDistribution" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chatbot_Ratings_Aggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pill_chatbotId_idx" ON "Pill"("chatbotId");

-- CreateIndex
CREATE INDEX "Pill_pillType_idx" ON "Pill"("pillType");

-- CreateIndex
CREATE INDEX "Pill_Usage_pillId_idx" ON "Pill_Usage"("pillId");

-- CreateIndex
CREATE INDEX "Pill_Usage_sessionId_idx" ON "Pill_Usage"("sessionId");

-- CreateIndex
CREATE INDEX "Pill_Usage_userId_idx" ON "Pill_Usage"("userId");

-- CreateIndex
CREATE INDEX "Pill_Usage_chatbotId_idx" ON "Pill_Usage"("chatbotId");

-- CreateIndex
CREATE INDEX "Event_sessionId_idx" ON "Event"("sessionId");

-- CreateIndex
CREATE INDEX "Event_userId_idx" ON "Event"("userId");

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE INDEX "Event_timestamp_idx" ON "Event"("timestamp");

-- CreateIndex
CREATE INDEX "Bookmark_userId_idx" ON "Bookmark"("userId");

-- CreateIndex
CREATE INDEX "Bookmark_chatbotId_idx" ON "Bookmark"("chatbotId");

-- CreateIndex
CREATE INDEX "Bookmark_createdAt_idx" ON "Bookmark"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_messageId_userId_key" ON "Bookmark"("messageId", "userId");

-- CreateIndex
CREATE INDEX "Conversation_Feedback_userId_idx" ON "Conversation_Feedback"("userId");

-- CreateIndex
CREATE INDEX "Conversation_Feedback_rating_idx" ON "Conversation_Feedback"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_Feedback_conversationId_key" ON "Conversation_Feedback"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Chatbot_Ratings_Aggregate_chatbotId_key" ON "Chatbot_Ratings_Aggregate"("chatbotId");

-- AddForeignKey
ALTER TABLE "Pill" ADD CONSTRAINT "Pill_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pill_Usage" ADD CONSTRAINT "Pill_Usage_pillId_fkey" FOREIGN KEY ("pillId") REFERENCES "Pill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pill_Usage" ADD CONSTRAINT "Pill_Usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pill_Usage" ADD CONSTRAINT "Pill_Usage_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pill_Usage" ADD CONSTRAINT "Pill_Usage_pairedWithPillId_fkey" FOREIGN KEY ("pairedWithPillId") REFERENCES "Pill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation_Feedback" ADD CONSTRAINT "Conversation_Feedback_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation_Feedback" ADD CONSTRAINT "Conversation_Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chatbot_Ratings_Aggregate" ADD CONSTRAINT "Chatbot_Ratings_Aggregate_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
