-- AlterTable
ALTER TABLE "Message" ADD COLUMN "followUpPills" TEXT[] DEFAULT ARRAY[]::TEXT[];

