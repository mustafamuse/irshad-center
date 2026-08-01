-- DropIndex: redundant single-column index subsumed by (teacherId, isActive)
DROP INDEX IF EXISTS "DugsiClassTeacher_teacherId_idx";
