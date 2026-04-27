-- @@unique([date]) on SchoolClosure already creates a B-tree index in PostgreSQL.
-- The explicit @@index([date]) was a duplicate — drop it to reduce write amplification.
DROP INDEX IF EXISTS "SchoolClosure_date_idx";
