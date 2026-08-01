---
paths:
  - lib/services/**
  - app/**/actions.ts
  - app/api/**
  - lib/safe-action.ts
---

## Error Handling

### The shape we throw

All server-action errors are `ActionError` with a typed code:

```ts
import { ActionError, ERROR_CODES } from '@/lib/errors'

throw new ActionError(
  'Student already enrolled in this cohort',
  ERROR_CODES.DUPLICATE_ENROLLMENT,
  undefined, // optional cause
  409 // HTTP status
)
```

Never throw bare strings or generic `Error`. Never leak Prisma `P2002` / `P2025` codes to clients — translate to `ERROR_CODES.*`.

### How next-safe-action surfaces it

v8 returns `{ data, serverError, validationErrors }`. `ActionError` populates `serverError` with the sanitized message + code. Clients destructure all three:

```tsx
const { execute, result, isPending } = useAction(myAction)
// result.data        — success payload
// result.serverError  — sanitized message + code from ActionError
// result.validationErrors — Zod field errors
```

### Pre-validation > catch-then-recover

Per project rule 6: use `findFirst` before write for user-facing uniqueness (email, phone, name). Database constraints (P2002) are safety nets, not primary error reporters.

**Never** try to recover from a constraint error inside `$transaction()` — PostgreSQL aborts the transaction on violation, so any further query in the same txn fails.

For truly concurrent public flows (registration, webhook idempotency), use `upsert` (`INSERT ... ON CONFLICT`) instead of check-then-insert.

### Logging the error

Always go through `logError`:

```ts
import { logger, logError } from '@/lib/logger'

try {
  await doThing()
} catch (err) {
  logError(logger, err, 'Failed to do thing', { studentId, cohortId })
  throw new ActionError('...', ERROR_CODES.OPERATION_FAILED)
}
```

`logError` adds structured context fields, scrubs PII via Pino's redact config, and sends to Axiom in production / pino-pretty in dev. Don't `console.error` — it bypasses redaction.

### Webhook handlers

Webhook routes must **always return 2xx** for events they don't process (otherwise Stripe retries forever). Pattern:

```ts
try {
  await handleEvent(event)
} catch (err) {
  logError(logger, err, 'Webhook handler failed', {
    eventId: event.id,
    type: event.type,
  })
  // Decide: retry or eat the error
  if (isTransient(err)) return new Response('retry', { status: 500 })
  return new Response('ok', { status: 200 }) // logged, won't retry
}
```

### Sentry boundaries

`@sentry/nextjs` captures uncaught exceptions automatically. Manual capture only when you want extra context:

```ts
import * as Sentry from '@sentry/nextjs'

Sentry.captureException(err, {
  tags: { program: 'mahad', area: 'billing' },
  extra: { studentId },
})
```

Don't double-capture: if you call `Sentry.captureException` AND let it propagate, you'll see two events. Either capture-and-swallow or let it propagate, not both.

### Gotchas

- `ActionError` cause field is **not** sent to the client (sanitized by safe-action). Use it for server logs only
- Don't catch `assertAdmin()` errors — let `adminActionClient` handle them
- Validation errors thrown by Zod inside an action become `serverError`, not `validationErrors` — only schema-level Zod errors populate `validationErrors`. Use `parsedInput` (already validated) inside the action body
- React Error Boundary catches render errors but not async ones from `useAction`; surface those via the `serverError` field directly in the UI
- `revalidatePath` calls inside `after()` (next/server) run post-response — if they throw, the user already got success. Test these paths carefully
