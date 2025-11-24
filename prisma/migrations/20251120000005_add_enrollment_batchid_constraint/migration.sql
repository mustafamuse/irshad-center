-- NOTE: PostgreSQL does not support subqueries in CHECK constraints
-- The business rule "Dugsi enrollments cannot have batchId" must be enforced at the application level
-- Original constraint (commented out due to PostgreSQL limitation):
-- CHECK (batchId IS NULL OR EXISTS (SELECT 1 FROM ProgramProfile WHERE id = programProfileId AND program = 'MAHAD_PROGRAM'))

-- No-op migration - constraint enforcement moved to application layer

