-- Change TeacherAttendanceRecord.checkInId FK from SET NULL to RESTRICT.
--
-- Rationale: DugsiTeacherCheckIn is an immutable fact log. SET NULL allowed
-- deleting a check-in row and silently severing the attendance record's link,
-- violating the "fact log is never modified" invariant.
-- RESTRICT makes the DB enforce that guarantee: the service layer must first
-- null out checkInId on the attendance record (inside the same transaction)
-- before deleting the check-in row.

ALTER TABLE "TeacherAttendanceRecord"
  DROP CONSTRAINT "TeacherAttendanceRecord_checkInId_fkey";

ALTER TABLE "TeacherAttendanceRecord"
  ADD CONSTRAINT "TeacherAttendanceRecord_checkInId_fkey"
  FOREIGN KEY ("checkInId") REFERENCES "DugsiTeacherCheckIn"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
