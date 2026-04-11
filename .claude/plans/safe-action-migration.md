# Plan: next-safe-action v7 Migration (Issue #193)

## Goal

Replace manual try/catch boilerplate across 13 action files with next-safe-action v7.
Fix the dual error system (AppError dead, ActionError active, withActionError broken).
Centralize Sentry/Axiom error handling in one place.

## Architecture

### 3 clients in `lib/safe-action.ts`

```typescript
// Base — Sentry + Axiom logging in handleServerError
export const actionClient = createSafeActionClient({ handleServerError })

// Admin — base + assertAdmin middleware
export const adminActionClient = actionClient.use(adminMiddleware)

// Rate-limited — base + rate limit middleware (for login, registration)
export const rateLimitedActionClient = actionClient.use(rateLimitMiddleware)
```

### Client-side bridge

Create `hooks/use-action-handler.ts` that wraps `useAction` from next-safe-action
and returns `{ success, data, error }` shape — preserving all existing client callsites.

### Error handling contract

- `ActionError` stays — caught in `handleServerError` → `serverError` string
- `ActionError` with field → returned as `validationErrors` via `returnValidationErrors()`
- `AppError` deleted (`lib/errors.ts`)
- `TeacherNotAuthorizedError`/`ClassNotFoundError` → converted to `ActionError`
- P2002 → `throwIfP2002` used consistently (already exists)
- Raw `throw new Error()` in services → converted to `ActionError` in Phase 6

---

## Migration Phases

### Phase 1 — Foundation (no behavior change)

1. Install `next-safe-action` v7
2. Create `lib/safe-action.ts` with 3 clients
3. Delete `lib/errors.ts` (AppError dead code)
4. Delete `withActionError` from `lib/utils/action-helpers.ts`
5. Convert `TeacherNotAuthorizedError`/`ClassNotFoundError` to `ActionError`
6. Create `hooks/use-action-handler.ts` bridge

### Phase 2 — Simple admin actions (low risk)

- `app/admin/mahad/payments/actions.ts` — `getBatchesForFilter`
- `app/admin/people/actions.ts` — `getMultiRolePeopleAction`
- `app/admin/people/lookup/actions.ts` — lookup + delete

### Phase 3 — Auth + rate limit actions

- `app/admin/login/actions.ts` — validateAdminPin, logoutAdmin (uses redirect())
- `app/teacher/checkin/actions.ts` — clockIn, clockOut, geofence

### Phase 4 — Complex admin actions

- `app/admin/dugsi/teachers/actions.ts` — teacher CRUD (largest file)
- `app/admin/dugsi/actions.ts` — classes, families, subscriptions (split first)
- `app/admin/link-subscriptions/actions.ts`
- `lib/actions/get-batch-data.ts`
- `lib/actions/update-student.ts`

### Phase 5 — Public/registration actions

- `app/mahad/register/_actions/index.ts` — registerStudent, checkEmailExists
- `app/dugsi/register/_actions/index.ts` — registerDugsiChildren, checkParentEmailExists
- `app/donate/actions.ts`
- `app/zakat-fitr/actions.ts`

### Phase 6 — Service layer raw throws

Convert 8+ `throw new Error()` in services to `ActionError`

### Phase 7 — Cleanup

- Delete `ActionResult<T>` type (or keep as type alias for compatibility)
- Delete `createErrorResult`, `createSuccessResult` from action-helpers
- Update any remaining plain action files (`lib/actions/get-students.ts`, `backup-data.ts`)
- Full test pass

---

## File-by-file notes

### `app/admin/login/actions.ts`

Uses `redirect()` after login — next-safe-action catches `NEXT_REDIRECT` correctly.
Rate limit currently inline — move to `rateLimitedActionClient` middleware.

### `app/admin/dugsi/attendance/actions.ts`

Stubbed via `createStubbedAction`. Skip — re-stub when feature is built.

### `lib/actions/get-students.ts`, `backup-data.ts`

Plain async functions, no `ActionResult`. Keep as-is — they're query/data functions,
not user-facing mutations. Do NOT migrate.

### Registration actions

Use `after()` from `next/server` — compatible with next-safe-action's `.action()` body.
`checkEmailExists` returns `boolean` — use `outputSchema(z.boolean())`.

### `app/admin/dugsi/actions.ts`

Largest file. Split into sub-files before migrating:

- `dugsi/class-actions.ts`
- `dugsi/family-actions.ts`
- `dugsi/subscription-actions.ts`

---

## Key constraints

- Never use `any` type
- Validate ALL external input with Zod (next-safe-action's `.inputSchema()`)
- Keep `assertAdmin` throwing `ActionError(UNAUTHORIZED)` — caught by adminMiddleware
- P2002 handling stays in services, not action layer
- `after()` calls are valid inside `.action()` bodies
