-- AlterTable
ALTER TABLE "Chunk_Performance" ADD COLUMN     "needsCaseStudyCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "needsExamplesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "needsScriptsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "needsStepsCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Message_Feedback" ADD COLUMN     "needsMore" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "specificSituation" TEXT;
