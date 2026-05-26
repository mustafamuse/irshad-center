---
description: Use when editing any file under lib/stripe/, lib/services/webhooks/, app/api/webhook/, or any server action that creates BillingAssignment, Subscription, or Customer. Enforces the Mahad vs Dugsi Stripe client separation.
paths:
  - lib/stripe/**
  - lib/services/webhooks/**
  - app/api/webhook/**
  - lib/services/shared/billing.ts
  - '**/actions.ts'
---

# Stripe dual-client rules

The Irshad Center platform runs **two separate Stripe accounts** — Mahad and Dugsi. Mixing clients between programs is the most recurring bug class in this codebase.

## The rule

| Program | Client                   | Import path               |
| ------- | ------------------------ | ------------------------- |
| Mahad   | `stripeServerClient`     | `lib/stripe/server`       |
| Dugsi   | `getDugsiStripeClient()` | `lib/stripe/dugsi-server` |

**Never** pass `program` as a parameter and switch clients based on it inside a shared function. The client must be picked at the call-site by the file's program domain.

## Where to check

- **Webhook handlers** (`app/api/webhook/mahad/route.ts`, `app/api/webhook/dugsi/route.ts`): each verifies signature with **its own** `STRIPE_WEBHOOK_SECRET_*` env var
- **Server actions in `app/admin/mahad/*/actions.ts`**: only `stripeServerClient`
- **Server actions in `app/admin/dugsi/*/actions.ts`**: only `getDugsiStripeClient()`
- **Shared services** (`lib/services/shared/billing.ts`): accept a Stripe instance as a parameter — caller picks

## Gotchas

- **Customer IDs are namespaced per account** — a Mahad `cus_xxx` does not exist in Dugsi and vice versa. Looking up a Mahad customer with the Dugsi client returns `customer.deleted = true` (silent failure)
- **Webhook idempotency is per-program**, not global. The `WebhookEvent` table has a composite key `(stripeEventId, program)`. Don't dedupe across programs
- **Test mode keys**: Mahad test mode and Dugsi test mode are different accounts too. If you see "no such customer" in dev, you may be using one account's test customer ID with the other account's client
- **Stripe CLI listening** (`stripe listen --forward-to ...`) defaults to whichever account `stripe login` was last run for. Be explicit: `stripe listen --api-key sk_test_mahad_xxx` or set `STRIPE_API_KEY` per shell
- **`BillingAssignment.amount`**: must be `> 0` (project rule 14). Stripe will silently accept 0-amount items in a subscription line; the DB constraint catches it
- **Race on customer creation**: per project rule 6, use `findFirst` before `customers.create`. Don't catch P2002 inside a `$transaction()`

## Quick audit checklist (before approving any Stripe-touching change)

1. Run `grep -nE 'stripeServerClient|getDugsiStripeClient' <changed-file>` — only one should appear
2. Verify webhook secret env var matches the route's program
3. `BillingAssignment` creation has `amount > 0` validation
4. `WebhookEvent` idempotency check happens **before** state mutation
5. No `revalidatePath()` with user-controlled string
6. Test for the **other** program's path also exists (or is explicitly noted as N/A)
