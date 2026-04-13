-- Add previousStatus to TeacherAttendanceRecord.
--
-- When a date is marked as a school closure, records are bulk-transitioned to
-- CLOSED. This column stores each record's status immediately before the closure
-- so that removeClosure() can restore the original state rather than blindly
-- reverting everything to EXPECTED.

ALTER TABLE "TeacherAttendanceRecord"
  ADD COLUMN "previousStatus" "TeacherAttendanceStatus";
