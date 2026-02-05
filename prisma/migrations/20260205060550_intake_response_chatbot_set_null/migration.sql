-- DropForeignKey
ALTER TABLE "Intake_Response" DROP CONSTRAINT "Intake_Response_chatbotId_fkey";

-- AddForeignKey
ALTER TABLE "Intake_Response" ADD CONSTRAINT "Intake_Response_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
