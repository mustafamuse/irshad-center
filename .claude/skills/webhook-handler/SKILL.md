---
description: Use when editing or creating Stripe webhook handlers under app/api/webhook/. Enforces signature verification, idempotency, and the dual-client separation.
paths:
  - app/api/webhook/**
  - lib/services/webhooks/**
---

# Stripe webhook handler conventions

## Required structure (every webhook handler)

```ts
import { headers } from 'next/headers'
import { stripeServerClient } from '@/lib/stripe/server' // or dugsi-server
import { prisma } from '@/lib/db'
import { logger, logError } from '@/lib/logger'

export async function POST(req: Request) {
  const body = await req.text()
  const sig = (await headers()).get('stripe-signature')

  // 1. Verify signature with program-specific secret
  let event
  try {
    event = stripeServerClient.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET_MAHAD! // or _DUGSI
    )
  } catch (err) {
    logError(logger, err, 'Webhook signature verification failed', {
      program: 'mahad',
    })
    return new Response('invalid signature', { status: 400 })
  }

  // 2. Idempotency: record event ID IMMEDIATELY, before any state mutation
  try {
    await prisma.webhookEvent.create({
      data: { stripeEventId: event.id, program: 'mahad', type: event.type },
    })
  } catch (err) {
    // P2002 = duplicate event, already processed — silently 200
    return new Response('already processed', { status: 200 })
  }

  // 3. Dispatch (in service layer, never inline in handler)
  await handleEvent(event)

  return new Response('ok')
}
```

## Hard rules

1. **Signature first, always** — `constructEvent()` before anything else
2. **Program-specific secret** — `STRIPE_WEBHOOK_SECRET_MAHAD` vs `STRIPE_WEBHOOK_SECRET_DUGSI`. Cross-using will silently fail in production
3. **Idempotency record before mutation** — if you mutate state and then try to record, a Stripe retry will double-process
4. **No business logic in the route handler** — dispatch to `lib/services/webhooks/mahad/` or `lib/services/webhooks/dugsi/`
5. **Always return 2xx for events you don't handle** — Stripe retries on non-2xx. Log + return 200
6. **`BillingAssignment` creation must validate amount > 0** (project rule 14)

## Gotchas

- **Stripe retries**: Stripe retries any non-2xx for up to 3 days with exponential backoff. A bug that throws will retry forever — eat the exception, log it, return 200, and add to a DLQ if you can't process
- **`event.data.object` is loosely typed** — assert the type at the top of each handler: `const subscription = event.data.object as Stripe.Subscription`
- **Race condition on customer creation**: two near-simultaneous `customer.created` events can race. Use `findFirst` + transaction guard, never catch P2002 inside `$transaction()`
- **Event ordering not guaranteed** — `customer.subscription.updated` can arrive before `customer.subscription.created`. Always read current state from Stripe, don't trust the event payload as truth
- **PII in logs** — `event.data.object` contains email, name, sometimes card last4. Pino's redact config must cover these fields — verify before logging the full object
- **Webhook listener in dev**: `bun run stripe:listen` forwards events from Stripe to localhost. Use `bun run dev:webhook` to run both at once. **Mahad and Dugsi share port 3000** — only one listener at a time unless you split routes
- **`raw-body` import**: Next.js 15 App Router gets the raw body via `await req.text()` — do not call `req.json()` first or signature verification fails

## Verification checklist

Before merging a webhook change:

- [ ] Signature verification uses correct env var for the program
- [ ] Idempotency record happens before mutation
- [ ] `WebhookEvent` row includes `program` field
- [ ] Handler returns 2xx for unhandled event types (logged, not thrown)
- [ ] PII redaction covers all newly logged fields
- [ ] Tested with `stripe trigger <event_type>` locally
- [ ] Tested duplicate delivery (re-trigger same event) returns 200 without re-mutating
