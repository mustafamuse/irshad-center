# Migration Rollback Guide

This document describes how to rollback the unified identity schema migration if needed.

## Important Notes

- **Fresh Database Only**: This rollback strategy assumes no production data exists
- **Data Loss**: Rolling back will drop all data in the new schema tables
- **Test First**: Always test rollback procedures in a non-production environment

## Current Migration

The unified identity schema migration (`unified_identity_schema`) creates:

- `Person` - Canonical identity records
- `ContactPoint` - Email, phone, WhatsApp contacts
- `ProgramProfile` - Program-specific profiles (Mahad, Dugsi)
- `GuardianRelationship` - Parent/guardian links
- `SiblingRelationship` - Sibling connections
- `Enrollment` - Program enrollment records
- `BillingAccount` - Stripe customer accounts
- `Subscription` - Active subscriptions
- `BillingAssignment` - Payment allocations
- `Teacher` - Teacher records
- `TeacherAssignment` - Teacher-student assignments
- `Batch` - Mahad cohorts/batches

## Rollback Procedures

### Option 1: Reset Database (Recommended for Fresh DBs)

```bash
# 1. Drop and recreate the database
npx prisma migrate reset --force --skip-seed

# 2. This will:
#    - Drop all tables
#    - Remove _prisma_migrations table
#    - Re-run all migrations from scratch
```

### Option 2: Revert to Previous Schema State

If you need to revert to a specific schema state:

```bash
# 1. Identify the migration to rollback to
ls prisma/migrations/

# 2. Manually drop tables (PostgreSQL)
# Connect to your database and run:
psql -d your_database_name << EOF
  -- Drop tables in reverse dependency order
  DROP TABLE IF EXISTS "SubscriptionHistory" CASCADE;
  DROP TABLE IF EXISTS "BillingAssignment" CASCADE;
  DROP TABLE IF EXISTS "Subscription" CASCADE;
  DROP TABLE IF EXISTS "BillingAccount" CASCADE;
  DROP TABLE IF EXISTS "TeacherAssignment" CASCADE;
  DROP TABLE IF EXISTS "Teacher" CASCADE;
  DROP TABLE IF EXISTS "Enrollment" CASCADE;
  DROP TABLE IF EXISTS "SiblingRelationship" CASCADE;
  DROP TABLE IF EXISTS "GuardianRelationship" CASCADE;
  DROP TABLE IF EXISTS "ContactPoint" CASCADE;
  DROP TABLE IF EXISTS "ProgramProfile" CASCADE;
  DROP TABLE IF EXISTS "Person" CASCADE;
  DROP TABLE IF EXISTS "Batch" CASCADE;

  -- Remove migration record
  DELETE FROM "_prisma_migrations"
  WHERE migration_name = 'unified_identity_schema';
EOF

# 3. Re-apply migrations up to desired point
npx prisma migrate deploy
```

### Option 3: Using Prisma's Shadow Database

For development environments:

```bash
# Reset the shadow database and re-apply
npx prisma migrate dev --name rollback_unified_schema
```

## Emergency Recovery

If you need to recover data:

1. **Export First**: Before any rollback, export data:

   ```bash
   pg_dump -d your_database > backup_$(date +%Y%m%d).sql
   ```

2. **Restore**: If rollback fails:
   ```bash
   psql -d your_database < backup_YYYYMMDD.sql
   ```

## Application-Level Constraints

The following constraints are enforced in application code, not the database:

| Constraint                      | Location           | Validation                   |
| ------------------------------- | ------------------ | ---------------------------- |
| Guardian can't be own dependent | `lib/services/`    | `guardianId !== dependentId` |
| Sibling ordering                | Sibling service    | `person1Id < person2Id`      |
| Dugsi can't have batchId        | Enrollment service | Check program before batchId |

Rolling back the schema does NOT affect these validations - they remain in code.

## Testing Rollback

Before rolling back production (if ever):

1. Create a test database with production schema
2. Apply the rollback procedure
3. Verify the application compiles against the reverted schema
4. Test critical user flows

## Contact

If you encounter issues during rollback, contact the engineering team immediately.
