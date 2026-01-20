-- AlterTable: Add options column to Intake_Question for SELECT and MULTI_SELECT response types
ALTER TABLE "Intake_Question" ADD COLUMN "options" JSONB;






