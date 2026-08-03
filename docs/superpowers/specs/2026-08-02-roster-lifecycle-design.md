# Roster lifecycle: add child, re-enroll, withdrawal reasons

Status: approved 2026-08-02
Scope: Dugsi only. Follow-up to per-child withdrawal (PR 245, issue 142).

## Problem

Withdrawal (PR 245) made billing follow the roster downward. The upward
direction is broken or missing:

- `addChildToFamily` (`lib/services/dugsi/family-service.ts`) creates the
  Person, guardian links, ProgramProfile, and Enrollment — but no
  BillingAssignment and no Stripe update. The new child is invisible to
  billing and the family bills at the stale tier.
- There is no re-enrollment path at all. A withdrawn child can only be
  re-added as a duplicate person.
- Withdrawal reasons are a hardcoded string; nothing is queryable about
  why families leave.

## Decisions (user-approved)

1. Billing auto-updates symmetrically on add and re-enroll, mirroring
   withdrawal's automatic downward adjustment.
2. Re-enrollment is a fresh start: new Enrollment row, no class-seat
   restore. The child re-enters unassigned and is placed through the
   existing class-assignment flow.
3. Withdrawal reasons are a preset list plus optional note, stored as
   string constants in the existing `Enrollment.reason` (`String?`).
   No migration.
4. Asymmetric failure handling: withdrawal keeps its DB-first saga with
   compensating rollback (money must stop when a child leaves). Add and
   re-enroll commit the roster change even when the Stripe sync fails —
   the child is legitimately on the roster either way — and surface a
   billing warning with a manual retry path (Recalculate rate button).

## Components

### 1. `updateDugsiSubscriptionPricing` — shared Stripe helper

Extracted from `withdrawal-service.ts` so the price-update + metadata
contract cannot drift between withdrawal and sync.

- Input: stripe client, stripeSubscriptionId, newRate (cents), roster
  (`{id, name}[]`), plus `clearCancelAtPeriodEnd: boolean`.
- Retrieves the subscription, guards missing line item / missing Dugsi
  product id (existing ActionError paths), updates item `price_data`
  (product from `getDugsiKeys()`, `getStripeInterval()`,
  `proration_behavior: 'none'`) and metadata: `Children`, `Rate`,
  `Tier`, `childCount`, `calculatedRate`, `profileIds`.
- Withdrawal calls it inside its existing try/rollback structure
  (behavior unchanged, including the connection-failure unknown-state
  branch). Sync calls it Stripe-first.

### 2. `syncFamilyBillingRate(familyReferenceId)` — new service

`lib/services/dugsi/billing-sync-service.ts`. Reconverges Stripe and DB
billing with the current roster. Idempotent; safe to call repeatedly.

Order and rules:

1. Guard: `findLiveFamilySubscriptionIds` > 1 → 409 ACTIVE_SUBSCRIPTION
   ("consolidate first"), same as withdrawal.
2. Roster = profiles with status REGISTERED or ENROLLED (the canonical
   child-count filter). Rate = `calculateDugsiRate(count)`.
3. No live subscription (none, or fully canceled) → no-op success with
   warning "no active subscription — family needs a new checkout".
   Never creates subscriptions.
4. Override detection: live Stripe amount differs from the calculated
   rate for the previous count → still overwrite to the calculated
   rate, return an override-reset warning (symmetric with PR 245).
5. Stripe first, via the shared helper. If the subscription has
   `cancel_at_period_end: true` and roster count > 0, clear it in the
   same update (re-enrollment into a cancel-pending subscription must
   not let the subscription die at period end). Paused subscriptions
   take the same path (price applies on resume).
6. Then one DB transaction: for each roster child, update the active
   BillingAssignment amount to its `calculateSplitAmounts` share, and
   create assignments for roster children that have none (covers
   add-child and re-enroll). Rule-14 guard: abort before writing if any
   split share <= 0. Update `Subscription.amount`.
7. Stripe succeeded but DB failed → `handleBillingDivergence` warning
   in the success payload, never a throw and never a rollback.

Returns `{ synced, rate, childCount, warning? }`.

### 3. `reEnrollChild(profileId)` — new service function

- Guard: profile exists, program DUGSI, status WITHDRAWN. Anything else
  → 409 INVALID_INPUT.
- Transaction: profile status → REGISTERED; create a new Enrollment row
  (status REGISTERED, startDate now). The withdrawn Enrollment row is
  not touched — history stays intact.
- Then `syncFamilyBillingRate` (its create-missing step produces the
  child's BillingAssignment when a live subscription exists). Sync
  failure → roster change stands, warning returned.
- No class enrollment is created (decision 2).

### 4. `addChildToFamily` — close the gap

Existing transaction unchanged; after it commits, call
`syncFamilyBillingRate` and attach any warning to the result. Sync
failure must not fail the add.

### 5. Withdrawal reasons

- `WITHDRAWAL_REASONS` const in `lib/constants/dugsi.ts`: Moved away,
  Schedule conflict, Financial, Switched program, Other.
- `WithdrawChildrenSchema`: add `reason: z.enum(WITHDRAWAL_REASONS)`
  and optional `note` (max 200). Stored as `"<preset>: <note>"` when a
  note is present, else the preset.
- `withdrawChildren` accepts the formatted reason and passes it to
  `withdrawEnrollmentsByIds`. Default 'Withdrawn by admin' remains for
  any caller that omits it.
- System paths untouched: the Stripe cascade keeps writing
  'Subscription canceled'; presets are distinct from both system
  strings.
- Withdraw dialog: required reason dropdown + optional note field.

### 6. Recalculate rate button

In `billing-tab.tsx` (owns the Subscription section). Calls a new
`recalculateFamilyRateAction` → `syncFamilyBillingRate`. This is the
retry path for every billing warning (sync failures, PR 245 divergence
and unknown-state cases).

### Actions

All three new/changed actions use `rateLimitedAdminActionClient` with
metadata, colocated Zod schemas in `lib/validations/dugsi.ts`,
`after(() => { revalidatePath('/admin/dugsi'); revalidateTag('dugsi-registrations') })`,
fixed error messages on rethrow, ActionError + existing ERROR_CODES.
Services use the query layer only (`lib/db/queries/`); any new query
functions accept `client: DatabaseClient = prisma`.

## Error handling summary

| Failure                                | Behavior                                        |
| -------------------------------------- | ----------------------------------------------- |
| Multiple live subscriptions            | 409, nothing changes                            |
| No live subscription                   | roster change stands, warning, no Stripe call   |
| Stripe update fails in sync            | roster change stands, warning, retry via button |
| DB re-split fails after Stripe success | divergence warning (handleBillingDivergence)    |
| Split share <= 0                       | abort DB txn before writing (rule 14)           |
| Re-enroll non-WITHDRAWN profile        | 409 INVALID_INPUT                               |

## Testing (TDD)

Tests are written first and must fail before implementation, using the
withdrawal suite's mock harness pattern (vi.hoisted mocks for query
layer, Stripe client, logger; `$transaction: (fn) => fn('tx-client')`).

- billing-sync-service: re-split updates, create-missing assignment,
  un-cancel on re-enroll, no-subscription warning, override warning,
  multi-sub 409, divergence path, rule-14 abort, paused path.
- re-enroll: status guard, fresh Enrollment row (old row untouched),
  sync invoked after txn, warning propagation.
- add-child: sync invoked, warning propagation, sync failure does not
  fail the add.
- shared pricing helper: metadata contract, cancel-flag clearing,
  missing-item/product guards (withdrawal suite keeps passing
  unchanged as the regression net).
- validations: reason enum, note max length, formatted storage.

## Out of scope

- Mahad (single-student billing, no family tiers).
- Creating subscriptions for families without one (existing checkout
  flow owns that).
- Class-seat restore on re-enroll (decision 2).
- Automatic retry/outbox for divergence (solo-operator repair path is
  the button; consistent with PR 245 review dismissals).
