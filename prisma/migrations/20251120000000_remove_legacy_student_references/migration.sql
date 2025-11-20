-- Remove Legacy Student References
-- This migration cleans up after the Student table was accidentally dropped

-- Drop foreign key constraints referencing Student (if they exist)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT
            tc.table_name,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'Student'
            AND tc.table_schema = 'public'
    ) LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;
END $$;

-- Drop indexes referencing Student (if they exist)
DROP INDEX IF EXISTS "Attendance_studentId_idx";
DROP INDEX IF EXISTS "AttendanceRecord_studentId_idx";
DROP INDEX IF EXISTS "StudentPayment_studentId_year_month_idx";

-- Update AttendanceRecord: Make enrollmentId required and remove studentId
-- Note: This assumes all AttendanceRecords have been migrated to use enrollmentId
-- If there are records with null enrollmentId, they need to be handled first

-- First, check if there are any AttendanceRecords with null enrollmentId
-- If yes, you'll need to migrate them manually before running this migration

-- Remove studentId column from AttendanceRecord (if it exists)
ALTER TABLE "AttendanceRecord" DROP COLUMN IF EXISTS "studentId";

-- Remove studentId unique constraint (if it exists)
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_sessionId_studentId_key";

-- Remove studentId index (if it exists)
DROP INDEX IF EXISTS "AttendanceRecord_studentId_idx";

-- Update StudentPayment: Make programProfileId required and remove studentId
-- Note: This assumes all StudentPayments have been migrated to use programProfileId
-- If there are records with null programProfileId, they need to be handled first

-- Remove studentId column from StudentPayment (if it exists)
ALTER TABLE "StudentPayment" DROP COLUMN IF EXISTS "studentId";

-- Remove studentId unique constraint (if it exists)
ALTER TABLE "StudentPayment" DROP CONSTRAINT IF EXISTS "StudentPayment_studentId_stripeInvoiceId_key";

-- Remove studentId index (if it exists)
DROP INDEX IF EXISTS "StudentPayment_studentId_year_month_idx";

-- Drop Student table if it still exists (shouldn't, but just in case)
DROP TABLE IF EXISTS "Student" CASCADE;

-- Drop Sibling table if it still exists (replaced by SiblingRelationship)
DROP TABLE IF EXISTS "Sibling" CASCADE;

-- Drop Attendance table if it still exists (replaced by AttendanceRecord)
DROP TABLE IF EXISTS "Attendance" CASCADE;

-- Drop AttendanceRecord and AttendanceSession tables (incomplete feature)
DROP TABLE IF EXISTS "AttendanceRecord" CASCADE;
DROP TABLE IF EXISTS "AttendanceSession" CASCADE;

-- Drop attendance-related enums
DROP TYPE IF EXISTS "AttendanceStatus" CASCADE;
DROP TYPE IF EXISTS "CheckInMethod" CASCADE;

-- Note: ClassSchedule/ClassSession/Subject/Semester removal is in separate migration
-- See: 20251120000001_remove_class_schedule_add_teacher_assignment

