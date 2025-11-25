# Security Action Plan - November 22, 2024

## Executive Summary

After running `npm audit fix`, 15 vulnerabilities remain:

- **Production risk:** 1 (xlsx - CAN BE REMOVED ✅)
- **Development risk:** 14 (acceptable, dev dependencies only)

---

## ✅ IMMEDIATE ACTION: Remove xlsx (5 minutes)

### Step 1: Remove Package

```bash
npm uninstall xlsx
```

### Step 2: Remove Unused File

```bash
rm lib/utils/export-to-excel.ts
```

### Step 3: Update Validation Schema

Edit `lib/validations/batch.ts` line 206:

**Before:**

```typescript
format: z.enum(['csv', 'xlsx', 'json'], {
  errorMap: () => ({ message: 'Format must be csv, xlsx, or json' }),
}),
```

**After:**

```typescript
format: z.enum(['csv', 'json'], {
  errorMap: () => ({ message: 'Format must be csv or json' }),
}),
```

### Step 4: Verify

```bash
npm audit --production  # Should show 0 production vulnerabilities
npm run build           # Should pass
npm run typecheck       # Should pass
```

**Expected Result:** ✅ Zero production vulnerabilities

---

## 📋 Development Vulnerabilities (Accept Risk)

The remaining 14 vulnerabilities are in development dependencies only:

### 1. localtunnel (High) - ACCEPT

- **Used in:** `npm run tunnel` (local dev only)
- **Risk:** Medium (development tool)
- **Action:** Document safe usage
- **Why accept:** Not deployed to production, only affects local dev

### 2. prisma-dbml-generator (High) - ACCEPT

- **Used in:** Schema diagram generation (dev only)
- **Risk:** Low (rarely run)
- **Action:** None required
- **Why accept:** Dev tool, minimal exposure

### 3. eslint-config-next (High) - UPDATE WHEN POSSIBLE

- **Used in:** Linting (dev/CI only)
- **Risk:** Low (linting tool)
- **Action:** Update to Next.js 15 ESLint config when time permits
- **Why accept now:** Low priority, dev tool only

---

## 🔒 Risk Assessment After Cleanup

### Production

- **Before:** 2 high severity vulnerabilities (xlsx)
- **After:** 0 vulnerabilities ✅

### Development

- **Before:** 13 vulnerabilities (localtunnel, prisma tools, ESLint)
- **After:** 13 vulnerabilities (ACCEPTED - dev tools only)

---

## 📅 Ongoing Security Monitoring

### Weekly

- Run `npm audit --production` before deploys
- Review any new production vulnerabilities

### Monthly

- Run full `npm audit`
- Review development vulnerabilities
- Update critical dependencies

### Quarterly

- Full security review
- Update all dependencies (major versions)
- Review and update security policies

---

## 🎯 Success Criteria

After completing the xlsx removal:

✅ **Production:** Zero known vulnerabilities
✅ **Development:** Documented and accepted risks
✅ **Build:** All tests and type checks pass
✅ **Deploy:** Safe to deploy to production

---

## Commands Reference

```bash
# Check production vulnerabilities only
npm audit --production

# Check all vulnerabilities
npm audit

# Fix non-breaking vulnerabilities
npm audit fix

# Force fix (may include breaking changes)
npm audit fix --force

# List outdated packages
npm outdated

# Update specific package
npm update package-name

# Update to latest major version
npm install package-name@latest
```

---

**Status:** Ready to execute
**Estimated Time:** 5 minutes
**Risk Level:** Very Low (removing unused code)
**Impact:** Eliminates production security vulnerability

---

## Next Steps

1. ✅ Run `npm uninstall xlsx`
2. ✅ Remove `lib/utils/export-to-excel.ts`
3. ✅ Update validation schema
4. ✅ Run `npm audit --production` (verify 0 vulnerabilities)
5. ✅ Commit changes with message: "security: remove unused xlsx dependency (fixes 2 high severity vulnerabilities)"
6. ✅ Deploy to production

**Total time:** ~5 minutes
**Benefit:** Eliminate 2 high severity production vulnerabilities
