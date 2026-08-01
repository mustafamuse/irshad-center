---
paths:
  - lib/**
  - app/**
  - middleware.ts
---

## Logging Conventions

### Use Pino, never console

```ts
import { logger, logError } from '@/lib/logger'

logger.info({ studentId, cohortId }, 'Student enrolled')
logger.warn({ event }, 'Unhandled webhook event')
logError(logger, err, 'Failed to charge customer', { customerId, amount })
```

`console.log` bypasses Pino's redact config, which means PII can leak to Axiom or stdout. CI lints `console.*` out of production code.

### Structured fields, not interpolation

```ts
// Bad
logger.info(`Charged ${customer.email} $${amount}`)

// Good
logger.info({ customerId: customer.id, amount }, 'Charged customer')
```

Structured fields are queryable in Axiom. Interpolated strings aren't. Also: emails in messages defeat redaction.

### Redacted fields (configured in `lib/logger.ts`)

Pino's redact list covers: `password`, `token`, `cardNumber`, `apiKey`, `secret`, `authorization`, `stripe_signature`, common nested paths under `req.headers`, `req.body.cardNumber`, etc.

If you add a new field that contains PII or secrets, **update the redact config** before logging it. Verify:

```bash
NODE_ENV=test bun run dev 2>&1 | grep -i "<sensitive value>"
# Should produce no output
```

### Log levels

| Level   | When                                                                          |
| ------- | ----------------------------------------------------------------------------- |
| `trace` | Local debugging only; never in production code                                |
| `debug` | Diagnostic context useful when investigating an issue. Off in prod by default |
| `info`  | Significant business events (enrollment, charge, webhook received)            |
| `warn`  | Recoverable anomalies (retry-able failure, unhandled-but-known event type)    |
| `error` | Unrecoverable failures, captured exceptions, alerting-worthy events           |
| `fatal` | Process should exit — almost never in a Next.js server                        |

`error` and above ship to Sentry via the `@sentry/nextjs` Pino transport. Don't over-log at `error` — it pages.

### Webhook handlers — always include the eventId

```ts
const log = logger.child({
  stripeEventId: event.id,
  program: 'mahad',
  type: event.type,
})
log.info('Webhook received')
try {
  await handle(event)
  log.info('Webhook processed')
} catch (err) {
  logError(log, err, 'Webhook processing failed')
  // ...
}
```

The child logger ensures every line in the handler carries the event ID — invaluable when correlating with Stripe's dashboard.

### Server actions — log the actionName

`adminActionClient` and `rateLimitedActionClient` automatically inject `metadata.actionName` into the logger context via the `next-safe-action` logger middleware. Don't re-log the action name; do log the entityId / userId.

### Production destinations

- **Pino → Axiom** (via `next-axiom`) — full structured logs, queryable, 30-day retention
- **Sentry** — errors only, with stack traces and breadcrumbs
- **Vercel logs** — short retention, raw stdout/stderr (last-resort visibility)

Dev uses `pino-pretty` for human-readable output. Production never uses pretty mode.

### Gotchas

- `logger.child({ ... })` returns a **new** logger. Reassigning a top-level `logger` import won't work; declare a local `log` instead
- Logging inside `after()` callbacks (post-response) shows up on Vercel but may be cut off if the function instance recycles. For critical post-response logs, use a queue or external write
- `JSON.stringify` of Prisma objects can throw on circular refs (when relations are loaded both ways). Pass the object directly to Pino — it has a serializer
- Logging `Stripe.Event.data.object` directly will dump email + last4 + customer name. Pick fields explicitly: `{ subId: sub.id, status: sub.status }`
- The `prefersReducedMotion: true` user setting and SSH/Termius workflow mean **no progress spinners in long-running scripts** — use `logger.info` for milestones
- pino-pretty's output is colored; in Termius via Tailscale SSH, colors render fine. In tmux nested sessions you may need `TERM=xterm-256color`
