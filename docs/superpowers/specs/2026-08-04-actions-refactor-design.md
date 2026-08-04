# Actions & Data-Layer Refactor — Design

**Date:** 2026-08-04
**Status:** Approved by Mustafa (scope: all four phases; high-risk services included with extra gates)
**Constraint:** Zero user-visible behavior change in every phase. No schema or migration changes anywhere.

## Motivation

No felt pain — this is principled cleanup. An audit of main (2026-08-04, HEAD 8a5da262) found:

- One rule-20 violation: `submitScholarshipApplication` is a public mutation on plain `'use server'` with hand-rolled rate limiting, manual Zod validation, a custom result shape, and no tests.
- Two monolith action files: `app/admin/dugsi/actions.ts` (1590 lines, ~34 actions across 5 domains) and `app/admin/mahad/_actions/index.ts` (1010 lines).
- ~85 raw `prisma.*` calls across 17 service files, violating rule 21 (services must use `lib/db/queries/`).
- Nearly every Dugsi admin mutation revalidates the broad `/admin/dugsi` path.
- `@tanstack/react-query` + devtools are installed and wrapped in two `QueryClientProvider`s (`app/providers.tsx`, `app/dugsi/register/providers.tsx`) but no component uses any react-query hook. Dead client-bundle weight. (`@tanstack/react-table` and `@tanstack/react-virtual` are in real use and stay.)

TanStack Query adoption was considered and rejected: single-admin app, no caching/optimistic-UI need, would duplicate the RSC data layer and contradict house rules 1–3.

## Rejected alternatives

- **TanStack Query for admin data fetching** — rejected (above).
- **One mega-PR** — rejected: unreviewable, risky. Sequenced independently-shippable PRs instead.
- **Re-export barrel to preserve old import paths in Phase 2** — rejected: `tsc` catches every dangling import, so a clean cut with updated import sites is safe and leaves no indirection.

## Execution conventions (all phases)

- Each PR gets a fresh worktree at `.claude/worktrees/<branch>` with branch === worktree name, cut from latest main; previous PR merges before the next branch cuts.
- Verification per PR: `bunx tsc --noEmit`, lint, full vitest suite, prod build (enforced by pre-push hook). Phases 1 and 4c also get `verify-app`.
- PRs via `/create-pr` format.

---

## Phase 1 — Secure (branch `scholarship-safe-action`)

### 1a. Migrate `submitScholarshipApplication` to `rateLimitedActionClient`

File: `app/mahad/scholarship/_actions/index.tsx` (169 lines). Current shape: plain `'use server'`, manual `checkRateLimit('scholarship-submit:${ip}', 5)` with fail-open headers handling, `scholarshipApplicationSchema.safeParse`, PDF generation (`generateScholarshipPDF`), admin email with PDF attachment (`sendEmail`), best-effort student confirmation email, custom `SubmitScholarshipResult` return shape.

Target:

- `const _submitScholarshipApplication = rateLimitedActionClient.metadata({ actionName: 'submitScholarshipApplication' }).schema(scholarshipApplicationSchema).action(async ({ parsedInput }) => { ... })` with an exported async wrapper, matching the house pattern.
- The existing `scholarshipApplicationSchema` from `app/mahad/scholarship/_schemas` becomes the `.schema()` — no separate manual `safeParse`.
- Business logic preserved exactly: PDF generation failure → `ActionError(SERVER_ERROR)`; admin-email failure → `ActionError(SERVER_ERROR)`; student confirmation email stays best-effort (log warning, never fail the submission).
- The hand-rolled `checkRateLimit` block and its fail-open try/catch are deleted — `rateLimitedActionClient` provides IP rate limiting (and already fails open when `x-forwarded-for` is absent).
- Success payload: `{ message: 'Your application has been submitted successfully' }`.
- The file keeps `.tsx` (it renders the `ScholarshipApplicationEmail` JSX). `SubmitScholarshipResult` interface is deleted.

Callsite: `app/mahad/scholarship/_components/form.tsx` moves from the custom `{success, error, code, field}` shape to the next-safe-action result (`data` / `serverError` / `validationErrors`), preserving the same user-facing messages, including the rate-limit message ("Too many attempts. Please try again later.") and the validation message ("Invalid form data. Please check all required fields.") or their `validationErrors`-derived equivalent.

Tests (new, none exist today): follow the established mock pattern in `app/admin/_test-utils/admin-action-client-mock.ts` / existing action tests — happy path (PDF + both emails invoked, success message), PDF failure → serverError, admin-email failure → serverError, confirmation-email failure → still succeeds, invalid input → validationErrors.

### 1b. Remove dead react-query

- Delete `QueryClientProvider` wrappers: `app/providers.tsx` and `app/dugsi/register/providers.tsx` (verified: no `useQuery`/`useMutation`/`useQueryClient` anywhere in the repo). If a providers file becomes an empty pass-through, remove the file and its usage in the corresponding layout.
- Remove `@tanstack/react-query` and `@tanstack/react-query-devtools` from package.json. Keep `@tanstack/react-table` and `@tanstack/react-virtual`.

---

## Phase 2 — Organize (branch `split-action-monoliths`)

Pure file moves. No logic edits, no signature changes, no new behavior. The private-def + exported-async-wrapper pattern moves with each action verbatim.

### 2a. Split `app/admin/dugsi/actions.ts` (1590 lines)

Into the existing `app/admin/dugsi/actions/` directory (joining `billing-actions.ts`):

- `family-actions.ts` — family CRUD, parent/child edits, shift, delete-family (incl. previews/reads for those dialogs).
- `class-actions.ts` — class CRUD, teacher assignment, student enrollment (incl. class reads).
- `payment-actions.ts` — payment links, bank verification, WhatsApp send, payment status/history reads.
- `subscription-actions.ts` — link/validate/consolidate subscription actions and previews.
- `read-actions.ts` — cross-domain reads that fit no single domain (`getDugsiRegistrations`, vCard export).

Domain assignment happens at plan time action-by-action; every one of the ~34 actions must land in exactly one file. `app/admin/dugsi/actions.ts` is deleted; the ~19 importing components update their import paths.

### 2b. Split `app/admin/mahad/_actions/index.ts` (1010 lines)

Same treatment within `app/admin/mahad/_actions/` (domain files decided at plan time from its ~11 actions; `vcard-actions.ts` already exists there as precedent). `index.ts` is deleted or reduced strictly to re-exports only if Next.js route-boundary constraints require it — default is deletion with import-site updates.

`app/admin/dugsi/teachers/actions.ts` (871 lines) stays: single-domain already.

Verification emphasis: `tsc` proves no dangling imports; full suite proves no behavior change; `git diff` should show moves, import updates, and nothing else.

---

## Phase 3 — Optimize (branch `scoped-revalidation`)

Narrow `revalidatePath` targets: map each mutation to the routes that render its data (e.g. class mutations → `/admin/dugsi/classes`; teacher mutations → `/admin/dugsi/teachers`; family/billing mutations → `/admin/dugsi`). Existing `revalidateTag` usage is untouched.

Rules:

- When in doubt, keep the broad path — under-invalidation is a bug, over-invalidation is only waste.
- A mutation whose data renders on multiple routes revalidates each of them.
- All calls stay inside `after()` (rule 19).

This is the only phase with behavioral surface (staleness risk), so every narrowed mutation gets a manual smoke check: perform the mutation in the dev server, confirm every page that shows the data reflects it.

---

## Phase 4 — Query layer (three PRs)

Move ~85 raw `prisma.*` calls from services into `lib/db/queries/`, per rule 21. House pattern: query functions take an optional client param defaulting to `prisma` so they compose with `$transaction` (`function findX(args, client: PrismaClientOrTx = prisma)`). Reuse existing query functions where one already covers the call; add to the domain-appropriate `lib/db/queries/*.ts` file otherwise. Services keep identical exported signatures and behavior — this is extraction, not redesign.

Per-service verification: the service's existing tests pass unchanged (mocks may move from `prisma.X.Y` to the query function); new query functions get focused unit tests only where they contain non-trivial where-clauses.

### 4a. Low-risk services (branch `query-layer-services`)

`validation-service.ts` (6 calls), `sibling-detector.ts` (7), `registration-service.ts` (13), `dugsi/registration-service.ts` (6), `dugsi/child-service.ts` (3), `dugsi/family-service.ts` (5), `dugsi/checkout-service.ts` (1), `dugsi/payment-service.ts` (1), `dugsi/subscription-service.ts` (2), `dugsi/billing-control-service.ts` (1), `whatsapp/whatsapp-service.ts` (2), `link-subscriptions/subscription-linking-service.ts` (3).

### 4b. Shared services (branch `query-layer-shared`)

`shared/parent-service.ts` (12), `shared/unified-matcher.ts` (11), `shared/billing-service.ts` (2). Billing is a high-risk path: security-reviewer pass before merge.

### 4c. Webhook services (branch `query-layer-webhooks`)

`webhooks/donation-handler.ts` (7), `webhooks/base-webhook-handler.ts` (3). High-risk paths (`lib/services/webhooks/**`): security-reviewer pass, full verification, and `verify-app` with a real `stripe trigger` event against the dev server before merge. Webhook idempotency (rule 12) and signature-verification code paths must be diff-reviewed explicitly.

Call counts are the audit snapshot from 2026-08-04; exact counts at implementation time govern.

## Out of scope

- TanStack Query adoption.
- Splitting `teachers/actions.ts`.
- Any Stripe, schema, or migration change.
- The stale `safe-action-migration` skill and memory index cleanup ships with Phase 1 (deleting `.claude/skills/safe-action-migration/`), since that skill instructs future sessions to redo completed work.

## Success criteria

- Zero plain-`'use server'` mutations remain (rule 20 fully satisfied; bare read-only utilities stay allowed).
- `grep -rc 'prisma\.' lib/services --include='*.ts'` (excluding tests and `$transaction` wrappers) returns zero violating files.
- No action file exceeds ~500 lines except `teachers/actions.ts`.
- Full vitest suite green and prod build green at every merge; no user-visible behavior change reported in any phase.
