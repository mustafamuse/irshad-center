---
paths:
  - 'lib/services/webhooks/**'
  - 'app/api/webhook/**'
  - 'lib/services/shared/billing-service.ts'
  - 'lib/services/shared/subscription-service.ts'
  - 'lib/services/shared/payment-service.ts'
---

## Stripe Conventions

### Dual Account Architecture

- Mahad account: `stripeServerClient` (from `lib/stripe/server.ts`)
- Dugsi account: `getDugsiStripeClient()` (from `lib/stripe/dugsi.ts`)
- NEVER mix clients — each program has its own Stripe secret key and webhook secret
- When writing code that handles both, always branch on program type early

### Webhook Requirements

- Always verify signatures with `constructEvent()` using the correct per-program secret
- Check `WebhookEvent` table for idempotency BEFORE processing any event
- Record event ID immediately after verification, before business logic
- Use `createWebhookHandler()` factory — never write raw webhook POST handlers
- Handle these events: `customer.subscription.created`, `.updated`, `.deleted`, `invoice.finalized`, `invoice.payment_failed`

### Billing Safety

- Never create `BillingAssignment` with amount <= 0
- Always use `prisma.$transaction()` when updating billing + subscription together
- When linking subscriptions to profiles, verify the profile belongs to the correct program
