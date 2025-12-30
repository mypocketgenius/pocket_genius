-- Add shortBio to Creator table
ALTER TABLE "Creator" ADD COLUMN "shortBio" TEXT;

-- Add shortDescription to Chatbot table
ALTER TABLE "Chatbot" ADD COLUMN "shortDescription" TEXT;

