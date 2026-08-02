---
name: migration-apply-flow
description: Migrations are applied manually, not by CI/Vercel — plus the offline way to verify a hand-written migration.sql matches what Prisma would emit
metadata:
  type: project
---

Nothing in this repo runs `prisma migrate deploy` automatically. `package.json` build is `prisma generate && next build`; `vercel.json` has no build override; the three GitHub workflows are Claude review/PR-template only. Migrations are applied by hand against the production database.

**Why:** it means a merged migration is not an applied migration. Code that depends on a migration (even softly, like an index) can ship before the SQL runs, and a migration can sit unapplied indefinitely without CI noticing drift.

**How to apply:** when reviewing, always state explicitly whether the code degrades gracefully if the migration has not been applied yet (index-only migrations do; NOT NULL / new-column migrations do not). For anything other than an index, call out apply-order: run the SQL before deploying the code.

**Offline verification technique.** The `prisma-migration-safety` skill's documented `prisma migrate diff --from-migrations` needs a shadow DB. This variant needs no database at all and is the fastest way to confirm a hand-written migration.sql is byte-identical to Prisma's own output (and therefore that `migrate diff` won't later report drift):

```
git show HEAD:prisma/schema.prisma > /tmp/old.prisma
bunx prisma migrate diff --from-schema-datamodel /tmp/old.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
```

**Full-history verification (needs a shadow DB — docker works).** The datamodel-to-datamodel diff above proves a migration.sql matches the schema delta, but not that the whole history converges. For that, spin up a throwaway Postgres — no need for any project env var:

```
docker run -d --name mig-shadow -e POSTGRES_PASSWORD=shadow -e POSTGRES_USER=shadow \
  -e POSTGRES_DB=shadow -p 55433:5432 postgres:15
SHADOW='postgresql://shadow:shadow@localhost:55433/shadow?schema=public'
bunx prisma migrate diff --from-empty --to-migrations prisma/migrations \
  --shadow-database-url "$SHADOW" --script          # does history replay at all?
bunx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW" --script  # expect empty
docker rm -f mig-shadow
```

Expect **both** to be non-clean today — see [[residual-migration-drift]] for the four known pre-existing items. Always compute the same two diffs against `HEAD` as a baseline and compare; byte-identical output means the change under review adds no drift.

Note the `block-dangerous.sh` hook blocks `rm -rf`, so build scratch copies of the migrations dir additively (`mkdir` + per-directory `cp -R`) rather than creating and deleting them.

Note `bunx prisma validate` fails with P1012 (`Environment variable not found: DIRECT_URL`) in a bare shell — that is an env-loading artifact, not a schema error. `migrate diff` parses the same datamodel fine, so use it as the validity signal instead.

Related: [[stale-migration-docs]]
