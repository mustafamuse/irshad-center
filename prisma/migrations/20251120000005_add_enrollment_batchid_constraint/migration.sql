-- Add CHECK constraint to prevent Dugsi enrollments from having batchId
-- This enforces the business rule at the database level that Dugsi program
-- does NOT use batches (only Mahad uses batches)

-- The constraint checks that if an enrollment has a batchId, the associated
-- ProgramProfile must be for MAHAD_PROGRAM, not DUGSI_PROGRAM
ALTER TABLE "Enrollment"
ADD CONSTRAINT "check_dugsi_no_batch" 
CHECK (
  "batchId" IS NULL OR 
  EXISTS (
    SELECT 1 
    FROM "ProgramProfile" 
    WHERE "ProgramProfile"."id" = "Enrollment"."programProfileId" 
    AND "ProgramProfile"."program" = 'MAHAD_PROGRAM'
  )
);

-- Add comment to explain the constraint
COMMENT ON CONSTRAINT "check_dugsi_no_batch" ON "Enrollment" 
IS 'Prevents Dugsi enrollments from having batchId - Dugsi uses teacher assignments instead of batches';

