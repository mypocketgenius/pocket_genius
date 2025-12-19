-- DropTable
-- Phase 3: Remove Message_Feedback table after migrating data to Pill_Usage and Events tables
-- Migration completed successfully - all data migrated to new tables
DROP TABLE IF EXISTS "Message_Feedback";

