---
description: Use when editing prisma/schema.prisma or any file under prisma/migrations/. Enforces reversibility and references the Mahad data deletion incident.
paths:
  - prisma/schema.prisma
  - prisma/migrations/**
allowed-tools: Read, Grep, Bash
---

# Prisma migration safety

A previous Claude Code session caused the **Mahad data deletion incident** (see `~/.claude/projects/-Users-mustafamuse-dev-irshad-center/memory/project_mahad_data_deletion.md`). This skill exists so it does not happen again.

## Hard rules (refuse to proceed if violated)

1. **No `prisma migrate reset`** — banned by project rule 4 and `block-dangerous.sh`
2. **No DROP TABLE** for `Student`, `Person`, `BillingAssignment`, `Subscription`, `WebhookEvent` — these are referenced by Stripe
3. **No DROP COLUMN** without explicit user-confirmed backup plan
4. **No RENAME via `@map`** without an explicit data-preservation migration (Prisma emits DROP + CREATE on rename)
5. **No `ALTER COLUMN` type change** on `BillingAssignment.amount` (Decimal precision matters for Stripe reconciliation)

## Required workflow

```bash
# 1. Generate SQL preview before applying anything
bunx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > /tmp/migration-preview.sql

# 2. Classify every statement: SAFE / RISKY / DESTRUCTIVE
# 3. If any DESTRUCTIVE → invoke migration-reviewer subagent
# 4. If RISKY (locks, NOT NULL without default) → discuss timing

bunx prisma migrate dev --name <descriptive_name>
```

## Gotchas

- **`migrate dev` will reset the DB if migrations are out of order** — never run in production. Use `migrate deploy` there
- **Schema drift**: editing `schema.prisma` without running `migrate dev` leaves the DB and schema out of sync. CI will flag, but locally it can mask bugs
- **NOT NULL on existing column**: Postgres requires an UPDATE pass to backfill before constraint applies — generates a 30-60s lock on hot tables (`Student` ~5k rows)
- **Adding UNIQUE constraint**: violates if existing data has dupes. Always `findFirst`-merge first
- **`@map()` rename**: changes the column name in the database without losing data. Always prefer this over a Prisma-side rename
- **Foreign-key cascade changes**: switching `onDelete: SetNull → Cascade` deletes rows that previously survived parent deletion. Audit before changing
- **WebhookEvent is append-only by design** — never accept a migration that adds DELETE / CASCADE / TRUNCATE touching it
- **prisma-dbml-generator** runs on every `prisma generate` — schema changes update `prisma/dbml/` artifact, expect to commit both

## Before any destructive change, run

```bash
# 1. Backup
pg_dump $DATABASE_URL > /tmp/backup-$(date +%Y%m%d-%H%M).sql

# 2. Confirm row counts you're about to affect
bunx prisma studio  # eyeball
# or
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Student\";"

# 3. Test the rollback path on a scratch DB
```

## When to invoke the migration-reviewer subagent

Use the `migration-reviewer` agent (Opus, read-only) whenever a migration touches:

- Any column on `Student`, `Person`, `BillingAssignment`, `Subscription`, `WebhookEvent`
- Any foreign-key relationship
- Any unique constraint
- Any type change on an existing column

```
Use the migration-reviewer agent to review this migration before I apply it.
```
