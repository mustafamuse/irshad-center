# Irshad Center - Claude Code Rules

## Stack

- Next.js 15.3.0 (App Router, Server Components)
- Prisma 6.16.2 + PostgreSQL
- TypeScript 5.9.0 (strict mode)
- Stripe (dual accounts: Mahad + Dugsi)
- Vitest + React Testing Library
- Pino logging + Sentry error tracking
- shadcn/ui + Tailwind CSS
- Zod + react-hook-form
- Zustand state management

---

## Git Operations

- After committing, list `git push` as a manual step for the user instead of running it directly
- If git push fails with auth errors, stop immediately and tell the user to run `gh auth setup-git` or check SSH keys
- Never retry a failed git push

---

## Environment Constraints

- User sometimes connects from iPhone via Termius/SSH - keep terminal output concise
- Do not assume browser/GUI access - prefer CLI-based solutions
- Always detect the actual environment before making platform-specific recommendations

---

## Critical Rules (Strict Enforcement)

Claude should refuse to write code violating these rules.

1. **Default to Server Components** - only add `'use client'` when required (interactivity, hooks, browser APIs)
2. **Use server actions for mutations** - prefer over API routes
3. **Minimize client components** - extract interactive parts into small client components, keep data fetching server-side
4. **Never reset production database** - forbidden: `prisma migrate reset`, `DROP TABLE`, `TRUNCATE`
5. **Use transactions for multi-table operations** - `prisma.$transaction()`
6. **Handle P2002 race conditions** - use upsert or catch P2002, never check-then-create without transaction
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

### Autonomous PR Pipeline

When asked to implement a feature end-to-end, follow this sequence without stopping between steps:

1. Implement the feature
2. Run `tsc --noEmit` and fix type errors
3. Run relevant tests and fix failures
4. Commit with a descriptive message
5. Report back with a summary and `git push` as manual next step

Do not pause for confirmation between steps unless a step fails more than twice.

### Parallel Agent Swarm for Refactors

When a refactor touches 3+ files independently, use the Task tool to spawn parallel agents:

- One agent per file or module
- Each agent reads the file, applies the pattern, and reports back
- Merge results sequentially after all agents complete
- Use this for: renames across files, pattern migrations, bulk type updates

### Self-Healing Test Loop

When tests fail after implementation, automatically fix and re-run:

1. Run tests
2. If failures: analyze error output, apply fix, re-run
3. Repeat up to 3 cycles
4. If still failing after 3 cycles, stop and report what was tried

---

See `CLAUDE_REFERENCE.md` for architecture patterns, DRY catalog, and file organization.
