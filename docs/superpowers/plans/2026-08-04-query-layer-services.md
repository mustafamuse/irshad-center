# Query Layer Migration — Low-Risk Services (Phase 4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Move every raw `prisma.*` call in the 18 low-risk service files into query functions under `lib/db/queries/`, per project rule 21, with zero behavior change.

**Architecture:** Extraction, not redesign. Each raw call becomes (or reuses) a query function in the domain-appropriate `lib/db/queries/*.ts` file. Services keep byte-identical exported signatures and semantics. `prisma.$transaction` wrappers stay in services; their callbacks call query functions with the tx client.

**Tech Stack:** Prisma, TypeScript, Vitest.

## Global Constraints

- Query function house pattern: last param `client: DatabaseClient = prisma`, with `DatabaseClient` imported from `@/lib/db/types` and `prisma` from `@/lib/db`. Matches `lib/db/queries/helpers.ts`.
- Reuse an existing query function whenever one already covers the call (check the target `lib/db/queries/*.ts` file first); otherwise add to the domain-appropriate file. Never create a new query file when a domain file exists.
- Services must keep identical exported names, signatures, return types, and behavior. No error-handling, logging, or where-clause changes.
- `prisma.$transaction(...)` may remain in services, but every call inside the callback goes through a query function receiving the tx client.
- Existing service tests pass with unchanged assertions; mocks may move from `prisma.X.Y` to the query function. Per `.claude/rules/testing-patterns.md`: `vi.mock` paths must match the exact import specifier.
- New query functions get a focused unit test only when they contain a non-trivial where-clause (compound OR/AND, normalization, dedup logic). Trivial delegations get no new test.
- Out of scope: `lib/services/shared/**` (Phase 4b), `lib/services/webhooks/**` (Phase 4c). Do not touch them.
- Gates per task: `bunx tsc --noEmit` clean, `bun run lint` delta-zero vs main, targeted tests green. Full `bun run test` after the final task.
- After each task: `grep -nE '\bprisma\.[a-zA-Z$]' <task files>` must show only `prisma.$transaction` lines (or nothing).
- One commit per task, message `refactor(query-layer): <scope>`.

Call counts below are the 2026-08-04 re-audit of this branch; the file's actual content at implementation time governs.

---

### Task 1: Root registration flow

**Files:** `lib/services/registration-service.ts` (14 calls), `lib/services/validation-service.ts` (6 calls). Query destinations: `lib/db/queries/student.ts`, `person.ts`, `program-profile.ts`, `enrollment.ts` as domain-appropriate.

### Task 2: Root matchers and mahad services

**Files:** `lib/services/sibling-detector.ts` (7), `lib/services/duplicate-detection-service.ts` (2), `lib/services/mahad/registration-service.ts` (1), `lib/services/mahad/student-service.ts` (2). Query destinations: `lib/db/queries/siblings.ts`, `person.ts`, `student.ts`, `program-profile.ts`.

### Task 3: Dugsi registration and family

**Files:** `lib/services/dugsi/registration-service.ts` (6), `lib/services/dugsi/child-service.ts` (3), `lib/services/dugsi/family-service.ts` (9). Query destinations: `lib/db/queries/person.ts`, `program-profile.ts`, `relationships.ts`, `enrollment.ts`.

### Task 4: Dugsi billing and subscription lifecycle

**Files:** `lib/services/dugsi/checkout-service.ts` (1), `payment-service.ts` (1), `subscription-service.ts` (2), `billing-control-service.ts` (1), `billing-sync-service.ts` (1), `consolidate-subscription-service.ts` (1), `withdrawal-service.ts` (2). Query destinations: `lib/db/queries/billing.ts`, `program-profile.ts`.

### Task 5: WhatsApp and link-subscriptions

**Files:** `lib/services/whatsapp/whatsapp-service.ts` (2), `lib/services/link-subscriptions/subscription-linking-service.ts` (3). Query destinations: `lib/db/queries/whatsapp.ts`, `billing.ts`, `program-profile.ts`.
