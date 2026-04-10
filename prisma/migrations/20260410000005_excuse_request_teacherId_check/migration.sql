-- Enforce that ExcuseRequest.teacherId always matches the teacherId on the
-- linked TeacherAttendanceRecord.
--
-- Rationale: teacherId is denormalized onto ExcuseRequest for fast lookups by
-- teacher. The service layer validates ownership at runtime (submitExcuse checks
-- record.teacherId !== teacherId inside a transaction), but a direct DB insert
-- (seed, migration, or future code path) with a mismatched teacherId would
-- silently succeed without a DB-level guard.
--
-- Implementation: PostgreSQL CHECK constraints cannot contain subqueries — the
-- syntax is accepted but the subquery is never evaluated (constraint always passes).
-- A BEFORE INSERT OR UPDATE trigger is the correct cross-table enforcement mechanism.
--
-- NULL safety: using `SELECT INTO` + `NOT FOUND` handles a missing
-- attendanceRecordId (FK not yet enforced or orphaned row) explicitly rather than
-- silently passing the `!=` comparison when the SELECT returns NULL.

CREATE OR REPLACE FUNCTION excuse_request_check_teacher_matches()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_teacher_id TEXT;
BEGIN
  SELECT "teacherId" INTO v_teacher_id
    FROM "TeacherAttendanceRecord" WHERE "id" = NEW."attendanceRecordId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TeacherAttendanceRecord not found: %', NEW."attendanceRecordId";
  END IF;
  IF NEW."teacherId" != v_teacher_id THEN
    RAISE EXCEPTION 'ExcuseRequest.teacherId does not match TeacherAttendanceRecord.teacherId';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ExcuseRequest_teacherId_check"
BEFORE INSERT OR UPDATE ON "ExcuseRequest"
FOR EACH ROW EXECUTE FUNCTION excuse_request_check_teacher_matches();
