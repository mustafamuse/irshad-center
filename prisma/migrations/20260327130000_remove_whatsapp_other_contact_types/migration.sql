-- Remove WHATSAPP and OTHER from ContactType enum.
-- Database has 0 WHATSAPP and 0 OTHER records (verified 2026-03-27).

-- Step 1: Create new enum without WHATSAPP and OTHER
CREATE TYPE "ContactType_new" AS ENUM ('EMAIL', 'PHONE');

-- Step 2: Convert column to new enum
ALTER TABLE "ContactPoint"
  ALTER COLUMN type TYPE "ContactType_new"
  USING type::text::"ContactType_new";

-- Step 3: Drop old enum and rename
DROP TYPE "ContactType";
ALTER TYPE "ContactType_new" RENAME TO "ContactType";

-- Step 4: Change isPrimary default from false to true
ALTER TABLE "ContactPoint" ALTER COLUMN "isPrimary" SET DEFAULT true;
