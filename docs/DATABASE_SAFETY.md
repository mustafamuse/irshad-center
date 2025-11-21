# Database Safety Protocol

## 🛡️ Critical Safety Rules

**NEVER run destructive database operations without proper safeguards.**

## Environment Configuration

### Required Environment Variables

**ALWAYS set `DATABASE_ENV` to explicitly identify the environment:**

```bash
# Production
DATABASE_ENV=PRODUCTION

# Staging
DATABASE_ENV=STAGING

# Development
DATABASE_ENV=DEVELOPMENT
```

### Environment Detection

The system automatically detects environment from:
1. `DATABASE_ENV` environment variable (highest priority)
2. `DATABASE_URL` patterns (staging, dev, production keywords)
3. `NODE_ENV` environment variable
4. Database record count (>100 records = likely production)

## Safety Checks

### Before ANY Destructive Operation

**ALWAYS run the safety check:**

```typescript
import { requireNonProductionEnvironment } from './scripts/db-safety-check'

// Before resetting database
await requireNonProductionEnvironment('Database Reset')
```

### Manual Safety Check

```bash
npx tsx scripts/db-safety-check.ts
```

This will:
- Detect the database environment
- Check for production indicators
- Verify database contents
- Report safety status

## Safe Database Reset

**NEVER use `prisma migrate reset` directly.**

**ALWAYS use the safe wrapper:**

```bash
# This will:
# 1. Check environment (blocks production)
# 2. Create backup automatically
# 3. Require --confirm flag
# 4. Log all operations

npx tsx scripts/safe-migrate-reset.ts --confirm
```

## Environment Setup

### Production (.env.local) - MAIN DATABASE
**This is your live, production database with real student data.**

```bash
DATABASE_ENV=PRODUCTION
DATABASE_URL="postgresql://...your-production-db..."
NODE_ENV=production
```

**Important:** `.env.local` contains your **PRODUCTION** database. Always set `DATABASE_ENV=PRODUCTION`.

### Staging (.env.staging) - TEST DATABASE
**This is your test database for trying changes before production.**

```bash
DATABASE_ENV=STAGING
DATABASE_URL="postgresql://...your-staging-db..."
NODE_ENV=production
```

**Important:** `.env.staging` contains your **STAGING** database. Always set `DATABASE_ENV=STAGING`.

### Development (localhost)
**For local development with a local database.**

```bash
DATABASE_ENV=DEVELOPMENT
DATABASE_URL="postgresql://localhost:5432/irshad_dev"
NODE_ENV=development
```

## Safety Checklist

Before running ANY destructive database operation:

- [ ] `DATABASE_ENV` is set correctly
- [ ] Safety check script passes
- [ ] Environment is NOT PRODUCTION
- [ ] Backup is created (if applicable)
- [ ] Operation is logged
- [ ] User has explicitly confirmed

## Forbidden Operations

**NEVER run these commands directly:**

```bash
# ❌ FORBIDDEN
npx prisma migrate reset
npx prisma db push --force-reset
DROP DATABASE ...
DROP TABLE ...
TRUNCATE TABLE ...
```

**ALWAYS use safe wrappers:**

```bash
# ✅ SAFE
npx tsx scripts/safe-migrate-reset.ts --confirm
```

## Emergency Override (USE WITH EXTREME CAUTION)

**Only in true emergencies:**

```bash
ALLOW_PRODUCTION_OPERATIONS=true npx tsx scripts/safe-migrate-reset.ts --confirm
```

**This will:**
- Still create a backup
- Still log the operation
- Still require confirmation
- But bypass production checks

**NEVER use this unless absolutely necessary and you understand the risks.**

## Recovery Procedures

If data is lost:

1. **Check Supabase Dashboard** for backups (Pro plan only)
2. **Check local backups** in `backups/` directory
3. **Recover from Stripe** using `scripts/recover-from-stripe.ts`
4. **Check application logs** for recent data
5. **Contact Supabase Support** if on Pro plan

## Prevention

1. **Always set `DATABASE_ENV`** in your environment files
2. **Always use safe wrappers** for destructive operations
3. **Always create backups** before major changes
4. **Always verify environment** before proceeding
5. **Never skip safety checks**

## Integration with CI/CD

Add safety checks to your deployment pipeline:

```yaml
# Example GitHub Actions
- name: Verify Database Environment
  run: npx tsx scripts/db-safety-check.ts
  env:
    DATABASE_ENV: ${{ secrets.DATABASE_ENV }}
```

## Monitoring

The safety check script logs:
- Environment detection
- Database URL (masked)
- Record counts
- Warnings and errors
- Safety status

Review these logs regularly to ensure proper environment configuration.

