-- Data Migration Script: Update CREATOR to BODY_OF_WORK
-- 
-- CRITICAL: This SQL must run BEFORE altering the ChatbotType enum
-- PostgreSQL enum changes require updating existing data BEFORE altering the enum type
--
-- Usage: This SQL will be added to the migration file in Subtask -1.2
-- It must be placed at the very top of the migration file (before any enum alterations)
--
-- Date: Created as part of Task -1.1.5
-- Related: Subtask -1.2 will incorporate this into the Prisma migration file

-- Update existing records BEFORE changing enum (must be first in migration)
UPDATE "Chatbot" SET type = 'BODY_OF_WORK' WHERE type = 'CREATOR';

-- Verification query (run after migration to confirm):
-- SELECT COUNT(*) FROM "Chatbot" WHERE type = 'BODY_OF_WORK';
-- SELECT COUNT(*) FROM "Chatbot" WHERE type = 'CREATOR'; -- Should return 0

