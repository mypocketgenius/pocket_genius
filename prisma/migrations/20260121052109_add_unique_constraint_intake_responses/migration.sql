/*
  Warnings:

  - A unique constraint covering the columns `[userId,intakeQuestionId,chatbotId]` on the table `Intake_Response` will be added. If there are existing duplicate values, this will fail.

*/
-- Delete duplicate Intake_Response records, keeping only the most recent one
DELETE FROM "Intake_Response"
WHERE id NOT IN (
  SELECT DISTINCT ON ("userId", "intakeQuestionId", "chatbotId") id
  FROM "Intake_Response"
  ORDER BY "userId", "intakeQuestionId", "chatbotId", "updatedAt" DESC
);

-- CreateIndex
CREATE UNIQUE INDEX "Intake_Response_userId_intakeQuestionId_chatbotId_key" ON "Intake_Response"("userId", "intakeQuestionId", "chatbotId");
