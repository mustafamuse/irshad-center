# Query Layer Migration — Shared Services (Phase 4b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Move every direct Prisma model call in `lib/services/shared/**` (except webhooks, Phase 4c) into query functions under `lib/db/queries/`, per project rule 21, with zero behavior change.

**Architecture:** Extraction, not redesign — same rules as Phase 4a (`docs/superpowers/plans/2026-08-04-query-layer-services.md`, merged as PR 255). Direct calls include literal `prisma.X`, `tx.X`, and `client.X` aliases where `client` is a Prisma client/tx parameter.

## Global Constraints

Identical to Phase 4a, plus:

- **Stripe calls stay put.** These services also hold Stripe API calls (`client.subscriptions.*` where `client` is a Stripe instance, `stripeServerClient.*`, etc.). Only Prisma model access moves. Never alter a Stripe call, and never route one through `lib/db/queries/`.
- **`billing-service.ts` is a high-risk path** (cross-program billing). It is implemented by the session controller directly, not a subagent, and the whole branch gets a `security-reviewer` pass before PR.
- Query function house pattern: last param `client: DatabaseClient = prisma` (`DatabaseClient` from `@/lib/db/types`, `prisma` from `@/lib/db`). Reuse existing query functions only on exact semantic match (where/select/include/orderBy/hints); else add a new one preserving the original byte-for-byte.
- Zero behavior change: identical exported names, signatures, return types, where-clauses, error handling, logging. `prisma.$transaction` stays in services; callbacks thread the tx client through query functions.
- Tests: mocks may move from Prisma stubs to query functions; assertion semantics preserved or strengthened (assert the tx sentinel where applicable). vi.mock paths must match import specifiers.
- Gates per task: `bunx tsc --noEmit` clean; `bun run lint` zero; targeted tests green; grep on task files shows no direct Prisma model access outside `$transaction` wrappers. Full `bun run test` after the last task.
- One commit per task, message `refactor(query-layer): <scope>`.

Call counts are the 2026-08-04 audit including tx/client aliases; file content at implementation time governs.

---

### Task 1: Parent and enrollment services

**Files:** `lib/services/shared/parent-service.ts` (~13), `lib/services/shared/enrollment-service.ts` (~1). Destinations: `lib/db/queries/person.ts`, `relationships.ts`, `enrollment.ts`, `program-profile.ts`.

### Task 2: Person service

**Files:** `lib/services/shared/person-service.ts` (~12). Destinations: `lib/db/queries/person.ts`, `program-profile.ts`, `relationships.ts`.

### Task 3: Teacher service

**Files:** `lib/services/shared/teacher-service.ts` (~20). Destinations: `lib/db/queries/teacher.ts`, `teacher-management.ts`, `person.ts`.

### Task 4: Unified matcher

**Files:** `lib/services/shared/unified-matcher.ts` (~11). Destinations: `lib/db/queries/person.ts`, `program-profile.ts`, `billing.ts`.

### Task 5: Billing service (controller-implemented, high-risk)

**Files:** `lib/services/shared/billing-service.ts` (~6 matches; distinguish Prisma vs Stripe calls first). Destinations: `lib/db/queries/billing.ts`. Security-reviewer pass over the whole branch afterward.
