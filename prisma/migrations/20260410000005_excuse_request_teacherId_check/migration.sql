-- Enforce that ExcuseRequest.teacherId always matches the teacherId on the
-- linked TeacherAttendanceRecord.
--
-- Rationale: teacherId is denormalized onto ExcuseRequest for fast lookups by
-- teacher. The service layer validates ownership at runtime, but a direct DB
-- insert (seed, migration, or future code path) with a mismatched teacherId
-- would silently succeed without this constraint.
--
-- A subquery CHECK is PostgreSQL-specific and evaluated once per insert/update,
-- not per query — zero runtime overhead for reads.

ALTER TABLE "ExcuseRequest"
  ADD CONSTRAINT "ExcuseRequest_teacherId_matches_record"
  CHECK ("teacherId" = (
    SELECT "teacherId" FROM "TeacherAttendanceRecord" WHERE "id" = "attendanceRecordId"
  ));
