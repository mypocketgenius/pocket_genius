-- AlterTable
ALTER TABLE "Chunk_Performance" ADD COLUMN     "copyToUseNowCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Message_Feedback" ADD COLUMN     "copyContext" TEXT,
ADD COLUMN     "copyUsage" TEXT;
