-- Drop redundant single-column indexes that are covered as prefixes of composite indexes.
-- TeacherAttendanceRecord:
--   [teacherId] is a prefix of [teacherId, date]
--   [date]      is a prefix of [date, shift, status]
--   [status]    standalone — no composite covers it, but global status scans are not a
--               query pattern in this codebase (removed to reduce write amplification)
-- ExcuseRequest:
--   [teacherId] is a prefix of [teacherId, status]

DROP INDEX IF EXISTS "TeacherAttendanceRecord_teacherId_idx";
DROP INDEX IF EXISTS "TeacherAttendanceRecord_date_idx";
DROP INDEX IF EXISTS "TeacherAttendanceRecord_status_idx";
DROP INDEX IF EXISTS "ExcuseRequest_teacherId_idx";
