-- Unify Shift and StudentShift enums into single Shift enum with MORNING/AFTERNOON
-- This migration:
-- 1. Creates new unified Shift enum with MORNING/AFTERNOON
-- 2. Converts TeacherAssignment.shift from old Shift to new (EVENING -> AFTERNOON)
-- 3. Converts ProgramProfile.shift from StudentShift to new Shift
-- 4. Drops old enums

-- Step 1: Create the new unified Shift enum
CREATE TYPE "Shift_new" AS ENUM ('MORNING', 'AFTERNOON');

-- Step 2: Update TeacherAssignment to use new enum
-- Convert EVENING to AFTERNOON, keep MORNING as-is
ALTER TABLE "TeacherAssignment"
  ALTER COLUMN shift TYPE "Shift_new"
  USING (
    CASE
      WHEN shift::text = 'EVENING' THEN 'AFTERNOON'::"Shift_new"
      WHEN shift::text = 'MORNING' THEN 'MORNING'::"Shift_new"
      ELSE NULL
    END
  );

-- Step 3: Convert ProgramProfile.shift from StudentShift to new Shift
-- StudentShift already has MORNING/AFTERNOON so direct conversion works
ALTER TABLE "ProgramProfile"
  ALTER COLUMN shift TYPE "Shift_new"
  USING shift::text::"Shift_new";

-- Step 4: Drop the old enums
DROP TYPE IF EXISTS "Shift";
DROP TYPE IF EXISTS "StudentShift";

-- Step 5: Rename new enum to Shift
ALTER TYPE "Shift_new" RENAME TO "Shift";
