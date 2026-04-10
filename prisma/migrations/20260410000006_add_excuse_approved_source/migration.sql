-- Add EXCUSE_APPROVED to AttendanceSource enum.
--
-- Using ADMIN_OVERRIDE for excuse approvals was misleading — both paths look
-- identical in the audit trail. EXCUSE_APPROVED makes the log unambiguous and
-- allows the UI badge to render "Excused (approved)" vs. "Admin Override".
--
-- PostgreSQL ALTER TYPE ADD VALUE is transactional in Postgres 12+ but cannot
-- be run inside an explicit BEGIN/COMMIT block — Prisma wraps migrations in
-- transactions by default. The pragma below opts this migration out of the
-- implicit transaction wrapper so the ADD VALUE statement succeeds.

-- migrate:noTransaction

ALTER TYPE "AttendanceSource" ADD VALUE 'EXCUSE_APPROVED';
