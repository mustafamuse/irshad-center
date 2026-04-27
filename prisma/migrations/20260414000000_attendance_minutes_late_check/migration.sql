-- Enforce that minutesLate is NULL on any TeacherAttendanceRecord whose status is not LATE.
--
-- Rationale: minutesLate is only meaningful when a teacher arrived late. Storing a
-- non-null value on EXPECTED/PRESENT/ABSENT/EXCUSED/CLOSED rows is definitionally
-- stale data — it would silently pollute queries like:
--   WHERE minutesLate IS NOT NULL   (would return wrong rows)
--   AVG(minutesLate)                (would skew lateness statistics)
-- App code already enforces this invariant at every write path; this constraint
-- makes it impossible for a future code path or direct DB write to violate it.
--
-- Backfill: clearing non-LATE rows with a non-null minutesLate is safe because
-- those values are already wrong by definition. No information is destroyed.

UPDATE "TeacherAttendanceRecord"
SET "minutesLate" = NULL
WHERE status != 'LATE' AND "minutesLate" IS NOT NULL;

ALTER TABLE "TeacherAttendanceRecord"
  ADD CONSTRAINT "attendance_minutes_late_only_when_late"
  CHECK ((status = 'LATE') OR "minutesLate" IS NULL);
