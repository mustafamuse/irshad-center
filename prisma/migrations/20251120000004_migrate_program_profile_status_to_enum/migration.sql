-- Migrate ProgramProfile.status from String to EnrollmentStatus enum
-- This normalizes the status field to use the same enum as Enrollment model

-- Step 1: Add new column with enum type
ALTER TABLE "ProgramProfile" 
ADD COLUMN "status_new" "EnrollmentStatus" DEFAULT 'REGISTERED';

-- Step 2: Map existing string values to enum values
-- Map common status strings to EnrollmentStatus enum values
UPDATE "ProgramProfile"
SET "status_new" = CASE
  WHEN LOWER("status") = 'registered' THEN 'REGISTERED'::"EnrollmentStatus"
  WHEN LOWER("status") = 'enrolled' THEN 'ENROLLED'::"EnrollmentStatus"
  WHEN LOWER("status") = 'on_leave' OR LOWER("status") = 'on leave' THEN 'ON_LEAVE'::"EnrollmentStatus"
  WHEN LOWER("status") = 'withdrawn' THEN 'WITHDRAWN'::"EnrollmentStatus"
  WHEN LOWER("status") = 'completed' THEN 'COMPLETED'::"EnrollmentStatus"
  WHEN LOWER("status") = 'suspended' THEN 'SUSPENDED'::"EnrollmentStatus"
  ELSE 'REGISTERED'::"EnrollmentStatus" -- Default for unknown values
END;

-- Step 3: Drop old column
ALTER TABLE "ProgramProfile" DROP COLUMN "status";

-- Step 4: Rename new column to status
ALTER TABLE "ProgramProfile" RENAME COLUMN "status_new" TO "status";

-- Step 5: Set NOT NULL constraint
ALTER TABLE "ProgramProfile" ALTER COLUMN "status" SET NOT NULL;

-- Step 6: Set default value
ALTER TABLE "ProgramProfile" ALTER COLUMN "status" SET DEFAULT 'REGISTERED'::"EnrollmentStatus";

-- Step 7: Recreate indexes that reference status
-- The composite indexes will be automatically updated since they reference the column by name
-- But we need to ensure the single-column index exists
CREATE INDEX IF NOT EXISTS "ProgramProfile_status_idx" ON "ProgramProfile"("status");

