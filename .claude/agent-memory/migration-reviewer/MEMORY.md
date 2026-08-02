# Memory Index

## Project

- [Migration apply flow](project_migration_apply_flow.md) — no automated `migrate deploy`; migrations applied by hand. Includes offline drift-check via `migrate diff`
- [Mahad DOB lookup](project_mahad_dob_lookup.md) — unauthenticated DOB-range lookup; the +/-26h window and standalone `Person.dateOfBirth` index are intentional
- [Replay-only reconciliation](project_replay_only_reconciliation.md) — the three `reconcile_*` migrations fix fresh-DB replay only; must be `resolve --applied` on prod, never executed

## Reference

- [Stale migration docs](reference_stale_migration_docs.md) — `docs/MIGRATION_ROLLBACK.md` recommends banned `migrate reset`; `prisma/dbml/` abandoned since 2025-06
