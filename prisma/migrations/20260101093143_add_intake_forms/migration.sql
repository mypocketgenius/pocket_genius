-- CreateEnum: IntakeResponseType enum
CREATE TYPE "IntakeResponseType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'FILE', 'DATE', 'BOOLEAN');

-- CreateEnum: ContextSource enum
CREATE TYPE "ContextSource" AS ENUM ('USER_PROVIDED', 'INFERRED', 'INTAKE_FORM', 'PLATFORM_SYNC');

-- CreateTable: Intake_Question
CREATE TABLE "Intake_Question" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "helperText" TEXT,
    "responseType" "IntakeResponseType" NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intake_Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Intake_Response
CREATE TABLE "Intake_Response" (
    "id" TEXT NOT NULL,
    "intakeQuestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatbotId" TEXT,
    "fileId" TEXT,
    "value" JSONB NOT NULL,
    "reusableAcrossFrameworks" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intake_Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable: User_Context
CREATE TABLE "User_Context" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatbotId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" "ContextSource" NOT NULL DEFAULT 'USER_PROVIDED',
    "confidence" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3),
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_Context_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Intake_Question chatbotId index
CREATE INDEX "Intake_Question_chatbotId_idx" ON "Intake_Question"("chatbotId");

-- CreateIndex: Intake_Question unique constraint
CREATE UNIQUE INDEX "Intake_Question_chatbotId_slug_key" ON "Intake_Question"("chatbotId", "slug");

-- CreateIndex: Intake_Response userId index
CREATE INDEX "Intake_Response_userId_idx" ON "Intake_Response"("userId");

-- CreateIndex: Intake_Response intakeQuestionId index
CREATE INDEX "Intake_Response_intakeQuestionId_idx" ON "Intake_Response"("intakeQuestionId");

-- CreateIndex: User_Context userId index
CREATE INDEX "User_Context_userId_idx" ON "User_Context"("userId");

-- CreateIndex: User_Context chatbotId index
CREATE INDEX "User_Context_chatbotId_idx" ON "User_Context"("chatbotId");

-- CreateIndex: User_Context unique constraint
CREATE UNIQUE INDEX "User_Context_userId_chatbotId_key_key" ON "User_Context"("userId", "chatbotId", "key");

-- AddForeignKey: Intake_Question to Chatbot
ALTER TABLE "Intake_Question" ADD CONSTRAINT "Intake_Question_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Intake_Response to Intake_Question
ALTER TABLE "Intake_Response" ADD CONSTRAINT "Intake_Response_intakeQuestionId_fkey" FOREIGN KEY ("intakeQuestionId") REFERENCES "Intake_Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Intake_Response to User
ALTER TABLE "Intake_Response" ADD CONSTRAINT "Intake_Response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Intake_Response to Chatbot
ALTER TABLE "Intake_Response" ADD CONSTRAINT "Intake_Response_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Intake_Response to File
ALTER TABLE "Intake_Response" ADD CONSTRAINT "Intake_Response_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: User_Context to User
ALTER TABLE "User_Context" ADD CONSTRAINT "User_Context_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: User_Context to Chatbot
ALTER TABLE "User_Context" ADD CONSTRAINT "User_Context_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

