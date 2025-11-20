# Database Scripts

## 🛡️ Safety First

**NEVER run destructive database operations without proper safeguards.**

## Available Scripts

### Safety Checks

#### `db-safety-check.ts`
Validates database environment before any operation.

```bash
npm run db:safety-check
# or
npx tsx scripts/db-safety-check.ts
```

**What it does:**
- Detects database environment (PRODUCTION/STAGING/DEVELOPMENT)
- Checks for production indicators
- Validates environment variables
- Reports safety status

**Use before ANY destructive operation.**

### Safe Database Reset

#### `safe-migrate-reset.ts`
**SAFE wrapper around `prisma migrate reset`**

```bash
npm run db:reset-safe -- --confirm
# or
npx tsx scripts/safe-migrate-reset.ts --confirm
```

**What it does:**
1. ✅ Validates environment (BLOCKS production)
2. ✅ Creates automatic backup
3. ✅ Requires `--confirm` flag
4. ✅ Logs all operations
5. ✅ Only then resets database

**NEVER use `prisma migrate reset` directly - always use this script.**

## Environment Setup

**CRITICAL: Always set `DATABASE_ENV`**

```bash
# Production
export DATABASE_ENV=PRODUCTION

# Staging
export DATABASE_ENV=STAGING

# Development
export DATABASE_ENV=DEVELOPMENT
```

Add to your `.env` files:
- `.env.production` → `DATABASE_ENV=PRODUCTION`
- `.env.staging` → `DATABASE_ENV=STAGING`
- `.env.local` → `DATABASE_ENV=DEVELOPMENT`

## Safety Protocol

Before ANY destructive operation:

1. ✅ Run `npm run db:safety-check`
2. ✅ Verify environment is NOT PRODUCTION
3. ✅ Ensure backup exists (or will be created)
4. ✅ Use safe wrapper scripts
5. ✅ Require explicit confirmation

## Forbidden Commands

**NEVER run these directly:**

```bash
# ❌ FORBIDDEN
npx prisma migrate reset
npx prisma db push --force-reset
```

**ALWAYS use safe wrappers:**

```bash
# ✅ SAFE
npm run db:reset-safe -- --confirm
```

## Emergency Override

**Only in true emergencies:**

```bash
ALLOW_PRODUCTION_OPERATIONS=true npm run db:reset-safe -- --confirm
```

**This is extremely dangerous and should never be used unless absolutely necessary.**

## Integration

Import safety checks in your scripts:

```typescript
import { requireNonProductionEnvironment } from './db-safety-check'

async function myDestructiveOperation() {
  // This will throw if production
  await requireNonProductionEnvironment('My Operation')
  
  // Safe to proceed...
}
```

## See Also

- [Database Safety Documentation](../docs/DATABASE_SAFETY.md)
