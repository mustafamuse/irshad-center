-- RefactorTeacherToUsePersonId
-- Migrates Teacher table from old schema (name, email, phone) to new unified identity system (personId → Person)
-- Since there are 0 Teacher records, no data migration is needed

-- Step 1: Add personId column (nullable initially for safety)
ALTER TABLE "Teacher" ADD COLUMN "personId" TEXT;

-- Step 2: Make personId NOT NULL (safe since table is empty)
ALTER TABLE "Teacher" ALTER COLUMN "personId" SET NOT NULL;

-- Step 3: Add unique constraint on personId
CREATE UNIQUE INDEX "Teacher_personId_key" ON "Teacher"("personId");

-- Step 4: Add foreign key constraint to Person table
ALTER TABLE "Teacher"
  ADD CONSTRAINT "Teacher_personId_fkey"
  FOREIGN KEY ("personId")
  REFERENCES "Person"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Step 5: Drop old unique email constraint
DROP INDEX IF EXISTS "Teacher_email_key";

-- Step 6: Remove old columns that are no longer needed
ALTER TABLE "Teacher" DROP COLUMN IF EXISTS "name";
ALTER TABLE "Teacher" DROP COLUMN IF EXISTS "email";
ALTER TABLE "Teacher" DROP COLUMN IF EXISTS "phone";

-- Step 7: Add index on personId for performance
CREATE INDEX "Teacher_personId_idx" ON "Teacher"("personId");
