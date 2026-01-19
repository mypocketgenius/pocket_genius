-- Migration: Make creator.slug required (non-nullable)
-- This migration:
-- 1. Generates slugs for any creators with null slugs
-- 2. Makes the slug column NOT NULL
-- 3. Ensures uniqueness is maintained

-- Step 1: Generate slugs for creators with null slugs
-- We'll use a simple approach: lowercase name, replace spaces with hyphens, remove special chars
DO $$
DECLARE
  creator_record RECORD;
  base_slug TEXT;
  final_slug TEXT;
  slug_counter INTEGER;
BEGIN
  -- Loop through all creators with null slugs
  FOR creator_record IN 
    SELECT id, name FROM "Creator" WHERE slug IS NULL
  LOOP
    -- Generate base slug from name
    base_slug := LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(creator_record.name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ));
    
    -- Remove leading/trailing hyphens
    base_slug := TRIM(BOTH '-' FROM base_slug);
    
    -- Ensure slug is not empty (fallback to creator ID if name is all special chars)
    IF base_slug = '' THEN
      base_slug := 'creator-' || SUBSTRING(creator_record.id FROM 1 FOR 8);
    END IF;
    
    -- Check if slug already exists, if so append a number
    final_slug := base_slug;
    slug_counter := 1;
    
    WHILE EXISTS (SELECT 1 FROM "Creator" WHERE slug = final_slug) LOOP
      final_slug := base_slug || '-' || slug_counter;
      slug_counter := slug_counter + 1;
    END LOOP;
    
    -- Update the creator with the generated slug
    UPDATE "Creator" 
    SET slug = final_slug 
    WHERE id = creator_record.id;
    
    RAISE NOTICE 'Generated slug "%" for creator "%" (ID: %)', final_slug, creator_record.name, creator_record.id;
  END LOOP;
END $$;

-- Step 2: Drop the unique constraint temporarily (if it exists as a separate constraint)
-- Note: The @unique in Prisma creates a unique index, which we'll handle below

-- Step 3: Make slug column NOT NULL
ALTER TABLE "Creator" 
ALTER COLUMN "slug" SET NOT NULL;

-- Step 4: Ensure unique constraint exists (it should already exist from Prisma schema)
-- This is a no-op if the constraint already exists, but ensures it's there
CREATE UNIQUE INDEX IF NOT EXISTS "Creator_slug_key" ON "Creator"("slug");



