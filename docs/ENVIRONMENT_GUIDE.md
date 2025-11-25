# Environment Guide: Production vs Staging

## Quick Reference

|                  | PRODUCTION         | STAGING                   |
| ---------------- | ------------------ | ------------------------- |
| **File**         | `.env.local`       | `.env.staging`            |
| **Type**         | Main/Live Database | Test Database             |
| **Data**         | Real student data  | Test data                 |
| **Reset**        | ❌ BLOCKED         | ✅ Allowed (with confirm) |
| **DATABASE_ENV** | `PRODUCTION`       | `STAGING`                 |

## 📊 What's What

### **PRODUCTION** (Main Database)

- **File:** `.env.local`
- **Purpose:** Your **live, production database** that your application uses
- **Contains:** Real student registrations, payments, enrollments
- **Status:** **PROTECTED** - cannot be reset or deleted
- **Safety:** Destructive operations are **BLOCKED**

### **STAGING** (Test Database)

- **File:** `.env.staging`
- **Purpose:** **Test database** for trying changes before production
- **Contains:** Test data (can be reset)
- **Status:** Can be reset with confirmation
- **Safety:** Operations allowed (with backups)

## ⚙️ Configuration

### Production (`.env.local`)

```bash
# .env.local
DATABASE_ENV=PRODUCTION
DATABASE_URL="postgresql://...your-production-db..."
DIRECT_URL="postgresql://...your-production-db-direct..."
NODE_ENV=production
```

**Important:** This is your **PRODUCTION** database. Always set `DATABASE_ENV=PRODUCTION`.

### Staging (`.env.staging`)

```bash
# .env.staging
DATABASE_ENV=STAGING
DATABASE_URL="postgresql://...your-staging-db..."
DIRECT_URL="postgresql://...your-staging-db-direct..."
NODE_ENV=production
```

**Important:** This is your **STAGING** database. Always set `DATABASE_ENV=STAGING`.

## Switching Environments

### Method 1: Load specific .env file

```bash
# Use production (main database)
export $(cat .env.local | grep -v '^#' | xargs)
npm run db:safety-check

# Use staging (test database)
export $(cat .env.staging | grep -v '^#' | xargs)
npm run db:safety-check
```

### Method 2: Set DATABASE_ENV explicitly

```bash
# Production
DATABASE_ENV=PRODUCTION npm run db:safety-check

# Staging
DATABASE_ENV=STAGING npm run db:safety-check
```

## Verification

**Always verify which environment you're using:**

```bash
npm run db:safety-check
```

This will show:

- Current environment (PRODUCTION/STAGING/DEVELOPMENT)
- Database URL (masked)
- Safety status
- Warnings/errors

## 🛡️ Safety Rules

### Production (`.env.local`)

- ❌ **BLOCKED:** Database resets
- ❌ **BLOCKED:** Drop operations
- ✅ **ALLOWED:** Read operations
- ✅ **ALLOWED:** Create/Update (with caution)
- ⚠️ **REQUIRED:** Explicit `DATABASE_ENV=PRODUCTION`

### Staging (`.env.staging`)

- ✅ **ALLOWED:** All operations (with confirmation)
- ✅ **ALLOWED:** Database resets (with `--confirm`)
- ⚠️ **RECOMMENDED:** Create backups before major changes
- ⚠️ **REQUIRED:** Explicit `DATABASE_ENV=STAGING`

## 🚨 Common Mistakes to Avoid

1. **Don't mix environments:**
   - ❌ Running production commands on staging data
   - ❌ Running staging commands on production data

2. **Always set DATABASE_ENV:**
   - ❌ Forgetting to set `DATABASE_ENV`
   - ✅ Always set it explicitly in `.env` files

3. **Verify before operations:**
   - ❌ Assuming you're on staging
   - ✅ Always run `npm run db:safety-check` first

## 💡 Best Practices

1. **Always set `DATABASE_ENV` explicitly** in your `.env` files
2. **Run safety check** before any destructive operation
3. **Use staging** to test migrations, resets, etc.
4. **Never reset production** - it's protected by safety checks
5. **Create backups** before major changes (even on staging)

## How to Know Which Environment You're Using

1. **Check your current `.env` file:**

   ```bash
   cat .env.local | grep DATABASE_ENV
   ```

2. **Run safety check:**

   ```bash
   npm run db:safety-check
   ```

3. **Check database record count:**
   - Production: Usually >100 students
   - Staging: Usually <50 students or test data

4. **Check database URL:**
   - Production: Usually Supabase production URL
   - Staging: Usually contains "staging" or separate Supabase project

## 📝 Remember

- **`.env.local`** = **PRODUCTION** (main database) - PROTECTED
- **`.env.staging`** = **STAGING** (test database) - Can reset
- Always set `DATABASE_ENV` explicitly
- Always verify with safety check before operations
