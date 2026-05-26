# Irshad Center - Claude Code Rules

## Stack

- Next.js 15.3.0 (App Router, Server Components)
- Prisma 6.16.2 + PostgreSQL
- TypeScript 5.9.0 (strict mode)
- Stripe (dual accounts: Mahad + Dugsi)
- Vitest + React Testing Library
- Bun (package manager)
- Pino logging + Axiom log aggregation + Sentry error tracking
- shadcn/ui + Tailwind CSS
- Zod + react-hook-form
- Zustand state management

---

## Git Operations

- If git push fails with auth errors, stop immediately and tell the user to run `gh auth setup-git` or check SSH keys
- Never retry a failed git push

---

## Environment Constraints

- User sometimes connects from iPhone via Termius/SSH - keep terminal output concise
- Do not assume browser/GUI access - prefer CLI-based solutions
- Always detect the actual environment before making platform-specific recommendations

---

## High-risk paths (require human review)

Per Erik Schluntz's leaf-node restriction pattern. Claude may edit these only with explicit user direction; auto-modes should treat them as read-only.

- `lib/services/shared/billing.ts` — cross-program billing logic
- `lib/services/webhooks/**` — Stripe webhook dispatchers
- `lib/stripe/**` — Stripe client configuration
- `prisma/schema.prisma` — schema source of truth
- `prisma/migrations/**` — applied migrations (also covered by `prisma-migration-safety` skill)
- `lib/safe-action.ts` — auth and rate-limit base
- `app/api/webhook/**` — webhook route handlers
- `middleware.ts` — auth middleware

When work touches these, invoke the appropriate specialty agent:

- `security-reviewer` for auth/webhook/admin-action changes
- `migration-reviewer` for any `prisma/migrations/**` or `prisma/schema.prisma` edit
- `verify-app` after the change to confirm behavior

## Critical Rules (Strict Enforcement)

Claude should refuse to write code violating these rules.

1. **Default to Server Components** - only add `'use client'` when required (interactivity, hooks, browser APIs)
2. **Use server actions for mutations** - prefer over API routes
3. **Minimize client components** - extract interactive parts into small client components, keep data fetching server-side
4. **Never reset production database** - forbidden: `prisma migrate reset`, `DROP TABLE`, `TRUNCATE`
5. **Use transactions for multi-table operations** - `prisma.$transaction()`
6. **Explicit pre-validation over constraint-catching** - use a `findFirst` check before writes for user-facing uniqueness validation (email, phone, name). Database constraints (P2002) are safety nets for bugs and race conditions, not primary error reporters. Never try to recover or run additional queries after catching a constraint error inside `$transaction()` — PostgreSQL aborts the transaction on violations. For truly concurrent public flows, use `upsert` (`INSERT ... ON CONFLICT`) instead of check-then-insert.
7. **Never use `any` type** - always use specific types
8. **Validate ALL external input with Zod** before database operations
9. **Always create new files as `.ts`/`.tsx`**, never `.js`/`.jsx`
10. **Use Prisma enums from generated types** - import from `@prisma/client`
11. **Always verify webhook signatures** - never process without `constructEvent()`, use program-specific secrets
12. **Implement webhook idempotency** - check `WebhookEvent` table before processing, record event ID immediately
13. **Use correct Stripe client per program** - Mahad: `stripeServerClient`, Dugsi: `getDugsiStripeClient()`
14. **Validate billing amounts before assignment** - never create BillingAssignment with amount <= 0
15. **Use ActionError with error codes** - `throw new ActionError(msg, ERROR_CODES.X, undefined, status)`
16. **Log errors with structured context** - `logError(logger, error, 'Context', { entityId })`
17. **Never log sensitive data** - Pino redacts passwords, tokens, card numbers, API keys
18. **Always return `ActionResult<T>`** from server actions
19. **Revalidate cache after mutations** - `revalidatePath()`

---

## Workflow Patterns

### Workflow skills (loaded on demand, not always-on)

- `/autopr` — autonomous PR pipeline (implement → typecheck → test → commit → push → `/create-pr`)
- `/swarm` — parallel agent fan-out for refactors touching 3+ independent files
- `/feature-gan` — three-agent harness (Planner/Generator/Evaluator) for non-trivial features
- `/notes` — bootstrap NOTES.md to externalize state for long tasks
- `/babysit` — handle PR review comments, rebase on main, shepherd toward merge

### PR Creation

All PRs use the `/create-pr` command. Do not use any other PR format.

### Self-Healing Test Loop

When tests fail after implementation, automatically fix and re-run:

1. Run tests
2. If failures: analyze error output, apply fix, re-run
3. Repeat up to 3 cycles
4. If still failing after 3 cycles, stop and report what was tried

### Babysit Loop (continuous PR handling)

For long-running PR shepherding, use the `/babysit` skill on a loop:

```
/loop 5m /babysit
```

It auto-rebases on main, addresses safe bot review comments per the policy in `babysit/SKILL.md`, and reports human-review items without auto-addressing them. Never auto-merges.

---

## Context Management

See `~/.claude/CLAUDE.md` "Context management (anti-rot protocol)" for the canonical NOTES.md → reset → re-read pattern. Applies to this codebase the same way.

For irshad-center specifically, when a task spans multiple Stripe + Prisma + UI areas, **always** write a `NOTES.md` at task start with:

- Decisions about which Stripe client (Mahad vs Dugsi)
- Whether a migration is needed (and the destructive/safe classification)
- Which path-attached skills apply (`stripe-dual-client`, `prisma-migration-safety`, `webhook-handler`)

---

Architecture patterns and DRY catalog are in `.claude/rules/` and load automatically when working in relevant files.
