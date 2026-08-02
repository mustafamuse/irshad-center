---
name: replay-only-reconciliation
description: Three reconcile_* migrations (2026-08) exist to fix fresh-DB replay only — they are marked applied via `migrate resolve`, never executed on production
metadata:
  type: project
---

Production's `_prisma_migrations` contains ~10 applied migrations whose files were lost with deleted branches. `schema.prisma` matches production exactly (`migrate diff` prod↔schema empty), but `prisma migrate deploy` on an **empty** database failed or drifted. Three migrations fix replay only:

- `20260402230000_reconcile_dugsi_class_teacher_table` — creates `DugsiClassTeacher`, which existed in prod with no creating migration. Timestamped _before_ `20260403000000` (which indexes it) so replay ordering works. Deliberately omits the `teacherId_isActive` index (20260403000000 adds it) and there is intentionally no `teacherId_idx` (20260403000001's `DROP INDEX IF EXISTS` is a designed no-op).
- `20260802000000_reconcile_attendance_academic_layer` — restores 52 introspected blocks.
- `20260802000001_reconcile_replay_parity` — tail: recreates both WhatsApp enums to final labels, `DROP TABLE "TeacherAssignment"`, creates `Person_name_dateOfBirth_idx`.

**Why:** these are catch-up files for state production already has. Verified read-only against prod: `TeacherAssignment` does NOT exist there, `Person_name_dateOfBirth_idx` does, both WhatsApp enums already hold the final label sets, `DugsiClassTeacher` exists with all its indexes. Full `migrate deploy` replay on throwaway Docker postgres:16 succeeded and diffed empty against schema.

**How to apply:** do not read the `DROP TABLE "TeacherAssignment"` in 20260802000001 as a rule-4 violation — it is replay-only and prod lacks the table. But the operational precondition is load-bearing: all three MUST be `prisma migrate resolve --applied` on production _before_ any `migrate deploy` ever touches it. If deploy runs first, the enum blocks (own `BEGIN/COMMIT`) commit as no-ops, then the un-guarded `ALTER TABLE "TeacherAssignment" DROP CONSTRAINT` aborts — leaving a failed row in `_prisma_migrations` needing `resolve --rolled-back`. Not data-destroying, but messy. The manual-apply flow ([[migration-apply-flow]]) is what keeps this safe; if automated deploy is ever added, revisit this first.

`TeacherAssignment` survives only in stale docs (`docs/teacher-system.md`, `docs/MIGRATION_ROLLBACK.md`) — see [[stale-migration-docs]]. No live code references it and there is no model in schema.prisma.
