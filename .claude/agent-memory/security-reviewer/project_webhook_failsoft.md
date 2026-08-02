---
name: webhook-failsoft
description: Why customer.subscription.created fails soft on unresolvable person (branch webhook-failsoft, slim replacement for PR #223) and what the recovery path depends on
metadata:
  type: project
---

`handleSubscriptionCreated` returns a result instead of throwing when no Person can be resolved for a Stripe subscription. Branch `webhook-failsoft`, adopted 2026-08 as the deliberately-slim replacement for PR #223 after a three-judge panel.

**Why:** throwing produced a 500 and 72h of Stripe retries for a failure that retrying can never fix (the person is simply not in the DB). Fail-soft returns 2xx, keeps the `WebhookEvent` row (the failure is permanent, so replay is pointless), and escalates via `Sentry.captureMessage(level: 'error', action: 'manual_linking_required')`. Matches the pre-existing fail-soft in `handleSubscriptionUpdated`.

**How to apply:** the fail-soft is only safe because recovery is real and independent of webhook replay:

- Orphan recovery is `getAllOrphanedSubscriptions()` in `lib/services/link-subscriptions/subscription-linking-service.ts`, which enumerates from **Stripe**, not from the DB — so a subscription with zero DB rows still surfaces on `/admin/link-subscriptions`.
- That enumeration filters to active/trialing/past_due, so a fail-soft orphan stuck in `incomplete` is invisible until it activates.
- Because the `WebhookEvent` row is retained, redelivering the event from the Stripe dashboard is a no-op (skipped by the idempotency check in `base-webhook-handler.ts`). Recovery must go through the admin page.

If anyone proposes deleting the `WebhookEvent` row on the fail-soft path, or making orphan detection DB-sourced, that breaks the design. Related: [[project-mahad-public-lookup]].
