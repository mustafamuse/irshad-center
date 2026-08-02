---
name: stale-migration-docs
description: docs/MIGRATION_ROLLBACK.md and prisma/dbml/schema.dbml are both stale — do not cite either as the rollback plan or demand dbml updates
metadata:
  type: reference
---

Two artifacts in this repo look authoritative for migration work but are not:

- **`docs/MIGRATION_ROLLBACK.md`** — written for the original `unified_identity_schema` migration and explicitly scoped to "Fresh Database Only / assumes no production data exists." Its Option 1 recommends `bunx prisma migrate reset --force --skip-seed`, which **directly contradicts project rule 4** and would be blocked by `block-dangerous.sh`. Do not point a reviewer or the user at this file as the rollback procedure for a present-day migration; write the rollback SQL inline in the review instead.
- **`prisma/dbml/schema.dbml`** — last regenerated 2025-06-10. It still only contains the legacy tables (Student, Sibling, Batch, StudentPayment, Attendance...) and has no Person/ProgramProfile/BillingAccount at all. The `prisma-migration-safety` skill says to expect committing `prisma/dbml/` alongside schema changes; in practice that artifact is abandoned. Do not flag a migration as incomplete for failing to update it.

Related: [[migration-apply-flow]]
