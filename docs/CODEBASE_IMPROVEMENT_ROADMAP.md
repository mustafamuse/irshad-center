# Codebase Improvement Roadmap

## Strategy: Incremental Chunk-by-Chunk Improvement

For each chunk, we follow this process:

1. **Review**: Run code review to identify issues
2. **Build**: Check TypeScript compilation
3. **Fix**: Address issues systematically
4. **Verify**: Ensure no new errors introduced
5. **Document**: Record changes made

---

## Chunks Overview

### Foundation Layer (lib/db, lib/types, lib/errors)

Core infrastructure that everything depends on

### Query Layer (lib/db/queries, lib/queries)

Database access layer

### Service Layer (lib/services)

Business logic organized by program

### API Layer (app/api)

HTTP endpoints and webhooks

### Admin Layer (app/admin)

Admin UI and actions

### Supporting Layer (lib/utils, lib/validations, etc.)

Utilities and helpers

---

## Detailed Chunk Breakdown

### 🟢 CHUNK 1: Foundation Layer (HIGHEST PRIORITY)

**Directories:**

- `lib/db/` - Database client and core types
- `lib/types/` - Shared TypeScript types
- `lib/errors.ts` - Error classes
- `lib/constants/` - Constants and enums

**Why First:** Everything depends on these. Fix these and many downstream errors will resolve.

**Expected Issues:**

- Type definition problems
- Missing exports
- Deprecated Prisma usage

**Status:** ⏸️ Not Started

---

### 🟡 CHUNK 2: Query Layer - Core Queries

**Directories:**

- `lib/db/queries/billing.ts`
- `lib/db/queries/enrollment.ts`
- `lib/db/queries/program-profile.ts`
- `lib/db/queries/student.ts`

**Why Second:** Core data access patterns. Services depend on these.

**Expected Issues:**

- Return type mismatches
- Missing transaction support
- N+1 query patterns

**Status:** ⏸️ Not Started

---

### 🟡 CHUNK 3: Query Layer - Deprecated Queries

**Directories:**

- `lib/queries/subscriptions.ts` (potentially deprecated)

**Why Third:** Identify what can be removed vs what needs migration.

**Expected Issues:**

- Duplicated logic with new queries
- Deprecated patterns

**Status:** ⏸️ Not Started

---

### 🟡 CHUNK 4: Shared Services

**Directories:**

- `lib/services/shared/billing-service.ts`
- `lib/services/shared/subscription-service.ts`
- `lib/services/shared/payment-service.ts`
- `lib/services/shared/unified-matcher.ts`
- `lib/services/shared/enrollment-service.ts`
- `lib/services/shared/parent-service.ts`

**Why Fourth:** These are used by both Mahad and Dugsi. Fix once, benefits everywhere.

**Expected Issues:**

- Type safety issues (we've seen some)
- Missing error handling

**Status:** 🟢 Partially Complete (Phase 1-4 done)

---

### 🔵 CHUNK 5: Mahad Services

**Directories:**

- `lib/services/mahad/cohort-service.ts`
- `lib/services/mahad/enrollment-service.ts`
- `lib/services/mahad/student-service.ts`

**Why Fifth:** Mahad-specific business logic.

**Expected Issues:**

- Type mismatches (we saw 10+ errors in enrollment-service)
- Schema migration issues

**Status:** ⏸️ Not Started

---

### 🔵 CHUNK 6: Dugsi Services

**Directories:**

- `lib/services/dugsi/child-service.ts`
- `lib/services/dugsi/registration-service.ts`
- `lib/services/dugsi/subscription-service.ts`

**Why Sixth:** Dugsi-specific business logic.

**Expected Issues:**

- Similar to Mahad but family-centric

**Status:** ⏸️ Not Started

---

### 🔵 CHUNK 7: Webhook Services

**Directories:**

- `lib/services/webhooks/webhook-service.ts`
- `lib/services/webhooks/base-webhook-handler.ts`

**Why Seventh:** Critical for Stripe integration.

**Expected Issues:**

- Type assertions (some already fixed)

**Status:** 🟢 Complete (Phase 5 done)

---

### 🔵 CHUNK 8: Link Subscriptions Service

**Directories:**

- `lib/services/link-subscriptions/`

**Why Eighth:** Specialized service for orphaned subscription management.

**Status:** ⏸️ Not Started

---

### 🟠 CHUNK 9: Validation & Sibling Services

**Directories:**

- `lib/services/validation-service.ts`
- `lib/services/sibling-detector.ts`
- `lib/services/registration-service.ts`

**Status:** 🟢 Partially Complete (sibling-detector Phase 1 done)

---

### 🟠 CHUNK 10: API Routes - Webhooks

**Directories:**

- `app/api/webhook/dugsi/route.ts`
- `app/api/webhook/route.ts` (Mahad)
- `app/api/webhook/student-event-handlers.ts`

**Status:** 🟢 Complete (Phase 4-5 done)

---

### 🟠 CHUNK 11: API Routes - Admin

**Directories:**

- `app/api/admin/retry-payment/route.ts`
- `app/api/admin/profit-share/route.ts`

**Status:** 🟢 Complete (deprecation fixed)

---

### 🟠 CHUNK 12: API Routes - Cron Jobs

**Directories:**

- `app/api/cron/cleanup-abandoned-enrollments/route.ts`

**Status:** 🟢 Complete (deprecation fixed)

---

### 🔴 CHUNK 13: Admin Actions - Dugsi

**Directories:**

- `app/admin/dugsi/actions.ts`

**Status:** ⏸️ Not Started

---

### 🔴 CHUNK 14: Admin Actions - Mahad

**Directories:**

- `app/admin/mahad/cohorts/_actions/`

**Status:** ⏸️ Not Started

---

### 🔴 CHUNK 15: Admin Actions - Payments

**Directories:**

- `app/admin/payments/actions.ts`
- `app/admin/link-subscriptions/actions.ts`

**Status:** 🟢 Complete (deprecation fixed)

---

### ⚪ CHUNK 16: Utilities & Helpers

**Directories:**

- `lib/utils/` (all utilities)
- `lib/validations/`
- `lib/mappers/`

**Why Last:** Lower priority, mostly stable helpers.

**Status:** ⏸️ Not Started

---

## Progress Tracker

| Chunk               | Status         | Errors Before | Errors After | Files Modified |
| ------------------- | -------------- | ------------- | ------------ | -------------- |
| Foundation Layer    | ⏸️ Not Started | TBD           | -            | -              |
| Core Queries        | ⏸️ Not Started | TBD           | -            | -              |
| Deprecated Queries  | ⏸️ Not Started | TBD           | -            | -              |
| Shared Services     | 🟢 Partial     | ~10           | ~0           | 8 files        |
| Mahad Services      | ⏸️ Not Started | 10+           | -            | -              |
| Dugsi Services      | ⏸️ Not Started | TBD           | -            | -              |
| Webhook Services    | 🟢 Complete    | 0             | 0            | 3 files        |
| Link Subscriptions  | ⏸️ Not Started | TBD           | -            | -              |
| Validation Services | 🟢 Partial     | ~1            | ~0           | 1 file         |
| API - Webhooks      | 🟢 Complete    | 0             | 0            | 3 files        |
| API - Admin         | 🟢 Complete    | 0             | 0            | 2 files        |
| API - Cron          | 🟢 Complete    | 0             | 0            | 1 file         |
| Admin - Dugsi       | ⏸️ Not Started | TBD           | -            | -              |
| Admin - Mahad       | ⏸️ Not Started | TBD           | -            | -              |
| Admin - Payments    | 🟢 Complete    | 0             | 0            | 1 file         |
| Utilities           | ⏸️ Not Started | TBD           | -            | -              |

**Total Progress:** 6/16 chunks complete (37.5%)

---

## Current Baseline

**Total TypeScript Errors:** 29
**Files With Errors:** ~15
**Major Error Categories:**

1. Type mismatches in Mahad enrollment/student services (10 errors)
2. Parent service null handling (3 errors)
3. React cache import (1 error)
4. Other misc (15 errors)

---

## Next Recommended Chunk

### 🎯 CHUNK 5: Mahad Services (10+ known errors)

**Rationale:**

- Clear, isolated errors
- High impact (admin functionality)
- Well-defined scope

**Process:**

1. Run code review on `lib/services/mahad/`
2. Build isolated: `npx tsc --project tsconfig.mahad-services.json`
3. Fix errors systematically
4. Verify no new errors
5. Update this roadmap

---

## Tools Created

### Custom TypeScript Configs

- `tsconfig.lib-queries.json` - Check lib/queries only
- `tsconfig.lib-services.json` - Check lib/services only
- `tsconfig.lib-all.json` - Check all lib/ directory

### Scripts

- `scripts/check-lib.sh` - Quick error count by directory

### Usage

```bash
# Check specific chunk
npx tsc --noEmit --project tsconfig.lib-services.json

# Count errors
npx tsc --noEmit --project tsconfig.lib-services.json 2>&1 | grep "error TS" | wc -l

# See detailed errors
npx tsc --noEmit --project tsconfig.lib-services.json 2>&1 | grep "error TS"
```

---

## Notes

- Always run full build after each chunk to ensure no regressions
- Update this document after completing each chunk
- Document major decisions in chunk-specific docs
- Maintain error baseline tracking
