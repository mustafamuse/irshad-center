---
name: paused-status-invariant
description: 'paused' is a DB-only Subscription status (Stripe stays 'active' with pause_collection set); Dugsi-only mapping, and which LIVE_SUBSCRIPTION_STATUSES guards treat paused as dead
metadata:
  type: project
---

`SubscriptionStatus.paused` exists only in our DB. Stripe never reports `status: 'paused'` for a `pause_collection`-paused subscription — it keeps `'active'`. Branch `pause-status-fix` (reviewed 2026-08-04) maps `pause_collection` + raw `'active'` -> `'paused'` inside `handleSubscriptionUpdated`, so the pause survives the webhook that the pause itself triggers.

**Why:** before the mapping, the DB `'paused'` write from `pauseFamilyBilling` was reverted to `'active'` seconds later by `customer.subscription.updated`. That masked a whole class of latent bugs: every guard built on `LIVE_SUBSCRIPTION_STATUSES` (which excludes `paused`) had never actually seen a persisted `'paused'` row in production.

**How to apply:** whenever anything makes `'paused'` more persistent or reachable, re-check the consumers that treat paused as dead. Two of them cost money and are still open as of 2026-08-04 (deliberately deferred to the double-subscription checkout-guard work): the `LIVE_SUBSCRIPTION_STATUSES` "has subscription" checks in `lib/services/shared/unified-matcher.ts` and `lib/services/link-subscriptions/subscription-linking-service.ts`, where a paused profile looks unlinked and can pick up a second subscription. The paths that already handle paused correctly spell it out: `[...LIVE_SUBSCRIPTION_STATUSES, 'paused']` in `lib/services/dugsi/billing-helpers.ts`, `LIVE_FALLBACK_SUBSCRIPTION_STATUSES` in `lib/db/queries/billing.ts`, and `CANCELABLE_SUBSCRIPTION_STATUSES` in `lib/db/query-builders.ts` (added by this fix so family delete cancels a paused sub in Stripe instead of orphaning it).

`handleSubscriptionUpdated` is shared with Mahad, so the mapping is deliberately gated on `accountType === 'DUGSI'`. Mahad has no pause/resume UI and `deriveStatus` in `lib/services/mahad/verification-service.ts` renders `'paused'` as a payment problem, so a Stripe-dashboard pause on a Mahad sub intentionally stays `'active'` in the DB. Do not simplify that gate away.

Related: [[webhook-failsoft]].
