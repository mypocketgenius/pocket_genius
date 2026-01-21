/*
  Warnings:

  - A unique constraint covering the columns `[userId,intakeQuestionId,chatbotId]` on the table `Intake_Response` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Intake_Response_userId_intakeQuestionId_chatbotId_key" ON "Intake_Response"("userId", "intakeQuestionId", "chatbotId");
