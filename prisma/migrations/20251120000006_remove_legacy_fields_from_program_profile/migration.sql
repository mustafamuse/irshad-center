-- Remove legacy fields from ProgramProfile table
-- These fields were kept for migration compatibility but are no longer needed

-- Step 1: Drop unique constraint on legacyStudentId (if exists)
ALTER TABLE "ProgramProfile" DROP CONSTRAINT IF EXISTS "ProgramProfile_legacyStudentId_key";

-- Step 2: Drop index on legacyStudentId (if exists)
DROP INDEX IF EXISTS "ProgramProfile_legacyStudentId_idx";

-- Step 3: Drop legacy fields
ALTER TABLE "ProgramProfile" DROP COLUMN IF EXISTS "legacyStudentId";
ALTER TABLE "ProgramProfile" DROP COLUMN IF EXISTS "legacyParentEmail";
ALTER TABLE "ProgramProfile" DROP COLUMN IF EXISTS "legacyParentFirstName";
ALTER TABLE "ProgramProfile" DROP COLUMN IF EXISTS "legacyParentLastName";
ALTER TABLE "ProgramProfile" DROP COLUMN IF EXISTS "legacyParentPhone";

