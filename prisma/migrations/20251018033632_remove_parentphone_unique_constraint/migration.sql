-- Remove unique constraint on parentPhone
-- Multiple children (siblings) should be able to share the same parent phone
DROP INDEX IF EXISTS "Student_parentPhone_normalized_key";

-- Keep the regular index for query performance
-- This allows multiple students with same parent phone (correct for Dugsi)
CREATE INDEX IF NOT EXISTS "Student_parentPhone_normalized_idx"
  ON "Student" ((regexp_replace("parentPhone", '\\D', '', 'g')))
  WHERE "parentPhone" IS NOT NULL;

