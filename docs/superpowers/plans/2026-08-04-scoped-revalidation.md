# Scoped Revalidation (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix wrong-target revalidations found by the 2026-08-04 revalidation audit; wrap the one set of bare `revalidatePath` calls in `after()`.

**Architecture:** The audit (appendix of this plan's PR description; full data in session) showed revalidation is already domain-scoped after the Phase 2 split — there is nothing to narrow. What it found instead: four spots where mutations revalidate a redirect stub, a nonexistent route, or nothing at all. This plan fixes exactly those. Spec rule applied: under-invalidation is a bug; over-invalidation is only waste — so additions are conservative-broad.

**Scope pivot note:** The spec's Phase 3 text ("narrow revalidatePath targets") was written before the audit; this plan supersedes it with data. No narrowing/trimming is performed (the belt-and-braces `revalidatePath('/admin/dugsi')` + tag pairs stay).

## Global Constraints

- Only `after(...)` blocks and revalidation targets change. No action logic, schemas, or signatures.
- All revalidation stays inside `after()` (rule 19).
- Verification: `bunx tsc --noEmit`, `bun run lint`, full `bun run test`; manual smoke of the teachers page staleness fix is deferred to post-merge (single-admin app, fix is strictly additive).

## Task 1: Teacher actions target the real teachers route

`app/admin/dugsi/teachers/actions.ts`:

- [ ] `deleteTeacherAction` (~:348): `revalidatePath('/admin/teachers')` → `revalidatePath('/admin/dugsi/teachers')`
- [ ] `assignTeacherToProgramAction` (~:487), `removeTeacherFromProgramAction` (~:531), `bulkAssignProgramsAction` (~:560): replace the `revalidatePath('/admin/teachers')` line with `revalidatePath('/admin/dugsi/teachers')` in each; KEEP the dynamic per-program path line as-is.

## Task 2: Teacher check-in actions refresh the admin teachers page

`app/teacher/checkin/actions.ts` (~:80, ~:120): `revalidatePath('/admin/dugsi/teacher-checkins')` → `revalidatePath('/admin/dugsi/teachers')` in both clock-in and clock-out actions. Keep `/teacher/checkin`.

## Task 3: deletePersonAction targets real routes

`app/admin/people/lookup/actions.ts` (~:69-78): replace `revalidatePath('/admin/people')` (no page exists) and `revalidatePath('/admin/teachers')` (redirect stub) with `revalidatePath('/admin/dugsi/teachers')`. Keep `/admin/people/lookup`, `/admin/dugsi`, `/admin/mahad`, and the three tags.

## Task 4: Link-subscription actions — after() + program cache invalidation

`app/admin/link-subscriptions/actions.ts` (`linkSubscriptionToStudent` ~:113, `ignoreSubscription` ~:147, `unignoreSubscription` ~:171):

- [ ] Wrap each pair of bare `revalidateTag`/`revalidatePath` calls in `after(() => { ... })` (import `after` from `next/server`).
- [ ] In `linkSubscriptionToStudent` only, additionally revalidate the program caches so dashboards stop showing the subscription as orphaned: add `revalidateTag('dugsi-registrations')`, `revalidateTag('mahad-students')`, `revalidateTag('mahad-stats')` (conservative-broad: the action links either program; tags are cheap).

## Task 5: Verification

- [ ] `bunx tsc --noEmit && bun run lint && bun run test` all green.
- [ ] `git diff main` shows only `after(`-block / revalidation-target lines changed in the four files.
