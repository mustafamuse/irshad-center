-- Add EXCUSE_APPROVED to AttendanceSource enum.
--
-- Using ADMIN_OVERRIDE for excuse approvals was misleading — both paths look
-- identical in the audit trail. EXCUSE_APPROVED makes the log unambiguous and
-- allows the UI badge to render "Excused (approved)" vs. "Admin Override".
--
-- Note: `-- migrate:noTransaction` below is a golang-migrate directive; Prisma
-- does not recognise it and still wraps this migration in a transaction. That
-- is fine: PostgreSQL 12+ lifted the restriction on ALTER TYPE ADD VALUE inside
-- transactions, so no workaround is needed.

-- migrate:noTransaction

ALTER TYPE "AttendanceSource" ADD VALUE 'EXCUSE_APPROVED';
