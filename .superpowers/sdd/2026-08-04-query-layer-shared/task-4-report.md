# Task 4: Unified matcher — report

## Status

Complete. All gates green.

## Scope

`lib/services/shared/unified-matcher.ts` — moved all 9 direct Prisma call sites (2 `programProfile.findFirst`/`findMany` metadata lookups, 4 `billingAccount.findFirst`, 2 `programProfile.findMany` checkout-match lookups, 1 `guardianRelationship.findMany`) into query functions. No Stripe calls in this file were touched. No `prisma.$transaction` usage in this file (all reads, no writes).

## New query functions

`lib/db/queries/program-profile.ts`:

- `findProgramProfileByIdAndProgram(profileId, program, client)` — `programProfile.findFirst({ where: { id, program } })`. No exact-match existing function (`findProgramProfileByPersonAndProgram` at line 860 matches on `personId`, not `id` — different semantics, so a new function was required).
- `findProgramProfilesForCheckoutMatch(personId, program, client)` — `programProfile.findMany` with `person: true` + active `assignments`/`subscription` include, `relationLoadStrategy: 'join'`. Used by both `findByCustomEmail` and `findByPhone` (identical query shape in both).
- `findProgramProfilesForPayerMatch(personId, program, client)` — same as above but without the `person` include (used by `findByPayerEmail`, which never reads `.person` on the result).

`lib/db/queries/relationships.ts`:

- `findActiveGuardianRelationshipsWithDugsiDependents(guardianId, client)` — `guardianRelationship.findMany({ where: { guardianId, isActive: true } })` with `dependent.programProfiles` filtered to `DUGSI_PROGRAM`, `relationLoadStrategy: 'join'`. No existing function matched this shape (existing `getGuardianDependentRelationships` includes enrollments, not programProfiles filtered by program).

## Reused query functions

- `findBillingAccountByPersonAndType(personId, accountType, client)` from `lib/db/queries/billing.ts` (line 195) — exact match for all 4 `billingAccount.findFirst({ where: { personId, accountType } })` call sites (metadata match, custom-email match, phone match, payer-email match). No new function needed.

## Behavior preservation

- Where-clauses, include shapes, `relationLoadStrategy: 'join'` flags, and orderings preserved byte-for-byte from the original inline calls.
- `Sentry.startSpan` wrappers around the metadata-lookup calls (`findProgramProfileByIdAndProgram`, `findBillingAccountByPersonAndType`) kept in the service — only the inner Prisma call moved.
- In-memory filtering logic (`unlinkedProfiles`, `LIVE_SUBSCRIPTION_STATUSES.includes`) untouched, stays in the service.
- `DUGSI_PROGRAM` constant (`'DUGSI_PROGRAM' as const`) used in place of the original string literal in `relationships.ts` — verified identical value.

## Test results

- `bunx tsc --noEmit` — clean.
- `bun run lint` — zero errors in changed files. One pre-existing unrelated warning in `app/admin/dugsi/teachers/components/checkin-history-tab.tsx` (not touched by this task).
- `bun run test lib/services/shared` — 83 passed (4 files). No existing unified-matcher test file to update (none existed prior to this change) — nothing to move.
- `bun run test lib/db/queries` — 151 passed (14 files). No `relationships.test.ts` exists either, so no assertions needed updating there.
- Grep on `unified-matcher.ts` confirms zero remaining `prisma.`/`tx.`/`client.` model calls — the two remaining `prisma.` references are type-only (`Awaited<ReturnType<typeof prisma.billingAccount.findFirst>>` in the `UnifiedMatchResult` interface), not calls.

## Concerns

- No pre-existing test coverage for `unified-matcher.ts` or `relationships.ts` — this refactor is unverified by any test beyond typecheck/lint. Worth flagging for a follow-up task to add coverage, but out of scope here (zero-behavior-change extraction only).
- None of the 3 new query functions are currently reused elsewhere; if Task 5 (billing-service) or future work needs equivalent lookups, check these first before adding near-duplicates.
