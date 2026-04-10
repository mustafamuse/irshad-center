-- Replace two narrower indexes with a single composite covering auto-mark and grid-view queries.
-- Auto-mark: WHERE date=$d AND shift=$s AND status='EXPECTED'
-- Grid view: WHERE date BETWEEN $from AND $to

DROP INDEX IF EXISTS "TeacherAttendanceRecord_date_shift_idx";
DROP INDEX IF EXISTS "TeacherAttendanceRecord_status_date_idx";

CREATE INDEX "TeacherAttendanceRecord_date_shift_status_idx"
  ON "TeacherAttendanceRecord" ("date", "shift", "status");
