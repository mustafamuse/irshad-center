-- Add unique constraint for name + dateOfBirth combination
-- This prevents duplicate students with same name and birth date
ALTER TABLE "Student" ADD CONSTRAINT "Student_name_dateOfBirth_key"
  UNIQUE ("name", "dateOfBirth");

-- Add partial unique index for phone (normalized to digits only)
-- This prevents duplicates even with different formats: +252-XXX vs 252XXX vs (XXX) XXX-XXXX
-- Uses PostgreSQL regexp_replace to strip non-digits before checking uniqueness
-- Only applies WHERE phone IS NOT NULL (partial index)
CREATE UNIQUE INDEX "Student_phone_normalized_key"
  ON "Student" ((regexp_replace(phone, '\\D', '', 'g')))
  WHERE phone IS NOT NULL;

-- Ensure parent contact columns exist for Dugsi students
ALTER TABLE "Student"
  ADD COLUMN IF NOT EXISTS "parentFirstName" TEXT,
  ADD COLUMN IF NOT EXISTS "parentLastName" TEXT,
  ADD COLUMN IF NOT EXISTS "parentEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "parentPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "parent2FirstName" TEXT,
  ADD COLUMN IF NOT EXISTS "parent2LastName" TEXT,
  ADD COLUMN IF NOT EXISTS "parent2Email" TEXT,
  ADD COLUMN IF NOT EXISTS "parent2Phone" TEXT,
  ADD COLUMN IF NOT EXISTS "healthInfo" TEXT;

-- Add partial unique index for parent phone (Dugsi registrations)
-- Same normalization logic as regular phone
CREATE UNIQUE INDEX "Student_parentPhone_normalized_key"
  ON "Student" ((regexp_replace("parentPhone", '\\D', '', 'g')))
  WHERE "parentPhone" IS NOT NULL;

-- Add indexes for performance on parent fields
CREATE INDEX IF NOT EXISTS "Student_parentEmail_idx" ON "Student" ("parentEmail");
CREATE INDEX IF NOT EXISTS "Student_parentPhone_idx" ON "Student" ("parentPhone");

-- Note: email already has unique constraint from previous migration
-- Note: We don't add citext extension because email case-sensitivity is handled in application
