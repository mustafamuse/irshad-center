# Irshad Center - Claude Code Rules

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

- `lib/services/shared/billing-service.ts` — cross-program billing logic
- `lib/services/webhooks/**` — Stripe webhook dispatchers
- `lib/stripe-*.ts` — Stripe client configuration (mahad, dugsi, factory, donation)
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
19. **Always wrap `revalidatePath` in `after()`** — `after(() => revalidatePath('/path'))` — calling it directly blocks the response. Import `after` from `next/server`.
20. **All server mutations must use safe-action clients** — `adminActionClient` or `rateLimitedActionClient` from `@/lib/safe-action`. Plain `'use server'` functions with `assertAdmin()` skip rate limiting, metadata, and error serialization. Only read-only query utilities may use bare `'use server'`.
21. **Never bypass the query layer** — services must call query functions from `lib/db/queries/` instead of calling `prisma.X.Y()` directly. Raw Prisma calls in service files defeat query testability and reuse.
22. **All `ActionError` throws must use a defined ERROR_CODE** — add the code to `lib/errors/action-error.ts` first. Never throw `ActionError` with a string literal code not in `ERROR_CODES`.

---

## Workflow Patterns

### Workflow skills (loaded on demand, not always-on)

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

## Domain Invariants

- **vCard export `skippedDuplicate` is contact-level, not family-level.** It counts each record that resolves to an already-seen contact (a bridge merge of 3 families into 1 contact yields `skippedDuplicate = 2`). Mahad omits `skippedDuplicate` entirely (the field is `undefined`, not `0`) because it has no cross-contact dedup. Do not rename this field to `skippedFamilies` or repurpose it for family-level counts.
- **vCard export family-key is a superset of `getFamilyKey()`.** The inline grouping in `_generateDugsiVCardContent` adds phone as a tertiary fallback and normalizes email. Do not replace it with a call to `getFamilyKey()` — they have intentionally different semantics. Phone-only families would silently break.

---

## Context Management

See `~/.claude/CLAUDE.md` "Context management (anti-rot protocol)" for the canonical NOTES.md → reset → re-read pattern. Applies to this codebase the same way.

For irshad-center specifically, when a task spans multiple Stripe + Prisma + UI areas, **always** write a `NOTES.md` at task start with:

- Decisions about which Stripe client (Mahad vs Dugsi)
- Whether a migration is needed (and the destructive/safe classification)
- Which path-attached skills apply (`stripe-dual-client`, `prisma-migration-safety`, `webhook-handler`)

---

Architecture patterns and DRY catalog are in `.claude/rules/` and load automatically when working in relevant files.
