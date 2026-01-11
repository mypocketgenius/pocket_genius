-- CreateTable: Chatbot_Intake_Question junction table
CREATE TABLE "Chatbot_Intake_Question" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "intakeQuestionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chatbot_Intake_Question_pkey" PRIMARY KEY ("id")
);

-- DropForeignKey: Remove old foreign key from Intake_Question to Chatbot
ALTER TABLE "Intake_Question" DROP CONSTRAINT "Intake_Question_chatbotId_fkey";

-- DropIndex: Remove old unique constraint on chatbotId and slug
DROP INDEX "Intake_Question_chatbotId_slug_key";

-- DropIndex: Remove old index on chatbotId
DROP INDEX "Intake_Question_chatbotId_idx";

-- AlterTable: Add createdByUserId column to Intake_Question (nullable first, then make NOT NULL)
ALTER TABLE "Intake_Question" ADD COLUMN "createdByUserId" TEXT;

-- AlterTable: Remove chatbotId, displayOrder, and isRequired columns from Intake_Question
ALTER TABLE "Intake_Question" DROP COLUMN "chatbotId",
DROP COLUMN "displayOrder",
DROP COLUMN "isRequired";

-- AlterTable: Make createdByUserId NOT NULL (safe since no existing questions)
ALTER TABLE "Intake_Question" ALTER COLUMN "createdByUserId" SET NOT NULL;

-- CreateIndex: Add unique constraint on slug (globally unique)
CREATE UNIQUE INDEX "Intake_Question_slug_key" ON "Intake_Question"("slug");

-- CreateIndex: Add unique constraint on junction table
CREATE UNIQUE INDEX "Chatbot_Intake_Question_intakeQuestionId_chatbotId_key" ON "Chatbot_Intake_Question"("intakeQuestionId", "chatbotId");

-- CreateIndex: Add index on chatbotId in junction table
CREATE INDEX "Chatbot_Intake_Question_chatbotId_idx" ON "Chatbot_Intake_Question"("chatbotId");

-- CreateIndex: Add index on intakeQuestionId in junction table
CREATE INDEX "Chatbot_Intake_Question_intakeQuestionId_idx" ON "Chatbot_Intake_Question"("intakeQuestionId");

-- AddForeignKey: Intake_Question to User (createdByUserId)
ALTER TABLE "Intake_Question" ADD CONSTRAINT "Intake_Question_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Chatbot_Intake_Question to Chatbot
ALTER TABLE "Chatbot_Intake_Question" ADD CONSTRAINT "Chatbot_Intake_Question_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Chatbot_Intake_Question to Intake_Question
ALTER TABLE "Chatbot_Intake_Question" ADD CONSTRAINT "Chatbot_Intake_Question_intakeQuestionId_fkey" FOREIGN KEY ("intakeQuestionId") REFERENCES "Intake_Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

