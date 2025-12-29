-- AlterEnum: Recreate ChatbotType enum with BODY_OF_WORK instead of CREATOR
-- PostgreSQL doesn't support removing enum values directly, so we recreate the enum
-- Step 1: Create new enum type with updated values (including BODY_OF_WORK)
CREATE TYPE "ChatbotType_new" AS ENUM ('BODY_OF_WORK', 'FRAMEWORK', 'DEEP_DIVE', 'ADVISOR_BOARD');

-- Step 2: Temporarily alter column to text type to allow data updates
ALTER TABLE "Chatbot" ALTER COLUMN "type" TYPE TEXT USING ("type"::text);

-- Step 3: Update existing records from CREATOR to BODY_OF_WORK
-- CRITICAL: This must run after column is text type but before enum recreation
UPDATE "Chatbot" SET type = 'BODY_OF_WORK' WHERE type = 'CREATOR';

-- Step 4: Alter the column to use the new enum type (with casting)
ALTER TABLE "Chatbot" ALTER COLUMN "type" TYPE "ChatbotType_new" USING ("type"::"ChatbotType_new");

-- Step 5: Drop the old enum type
DROP TYPE "ChatbotType";

-- Step 6: Rename the new enum type to the original name
ALTER TYPE "ChatbotType_new" RENAME TO "ChatbotType";

