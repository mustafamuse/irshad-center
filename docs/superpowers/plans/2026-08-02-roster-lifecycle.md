# Roster Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Dugsi billing follow the roster upward (add child, re-enroll) the way PR 245 made it follow downward, and capture structured withdrawal reasons.

**Architecture:** A shared Stripe pricing helper is extracted from the withdrawal service; a new idempotent `syncFamilyBillingRate` service reconverges Stripe + DB billing with the roster (Stripe-first, divergence-warning); `reEnrollChild` and `addChildToFamily` call it after committing roster changes. Withdrawal reasons become a preset enum + optional note in the existing `Enrollment.reason` string column (no migration).

**Tech Stack:** Next.js 15 server actions (next-safe-action v8), Prisma, Stripe (Dugsi client only: `getDugsiStripeClient()`), Zod, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-roster-lifecycle-design.md` — read it before starting any task.
- TDD: every task writes its failing test first and runs it red before implementing.
- Dugsi Stripe client only (`@/lib/stripe-dugsi`); never `stripeServerClient`.
- Services call `lib/db/queries/` functions only — no raw `prisma.X.Y()` in services (rule 21). New query fns take `client: DatabaseClient = prisma` as last param.
- No BillingAssignment with amount <= 0 (rule 14).
- Actions: `rateLimitedAdminActionClient` + `.metadata({actionName, maxAttempts})` + colocated Zod schema in `lib/validations/dugsi.ts` + `after(() => { revalidatePath('/admin/dugsi'); revalidateTag('dugsi-registrations') })` + fixed-message rethrow with `ERROR_CODES.SERVER_ERROR` (see `app/admin/dugsi/withdrawal-actions.ts` as the template).
- ActionError codes must already exist in `lib/errors/action-error.ts` (FAMILY_NOT_FOUND, INVALID_INPUT, STRIPE_ERROR, ACTIVE_SUBSCRIPTION, SERVER_ERROR all exist — no new codes needed).
- Test runner: `bun run test <path>` (never npx vitest). Full suite must stay green after every task; the withdrawal suite (`lib/services/dugsi/__tests__/withdrawal-service.test.ts`) is the regression net for Task 2.
- Roster/child-count filter is always `status IN ('REGISTERED', 'ENROLLED')`.
- No comments in code except non-obvious business constraints. No emojis anywhere.
- Commit after each task (pre-commit runs prettier/eslint; pre-push runs a ~3-min prod build — use a 600000ms timeout when pushing).

---

### Task 1: Withdrawal reason constants, schema, and formatting

**Files:**

- Modify: `lib/constants/dugsi.ts` (add `WITHDRAWAL_REASONS`)
- Modify: `lib/validations/dugsi.ts` (extend `WithdrawChildrenSchema`, add `formatWithdrawalReason`)
- Test: `lib/validations/__tests__/dugsi.test.ts` (create if absent)

**Interfaces:**

- Consumes: existing `WithdrawChildrenSchema`.
- Produces: `WITHDRAWAL_REASONS: readonly ['Moved away', 'Schedule conflict', 'Financial', 'Switched program', 'Other']`; `WithdrawChildrenSchema` gains `reason: z.enum(WITHDRAWAL_REASONS)` and `note: z.string().max(200).optional()`; `formatWithdrawalReason(reason: string, note?: string): string`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/validations/__tests__/dugsi.test.ts
import { describe, expect, it } from 'vitest'

import { WITHDRAWAL_REASONS } from '@/lib/constants/dugsi'
import {
  WithdrawChildrenSchema,
  formatWithdrawalReason,
} from '@/lib/validations/dugsi'

const VALID_INPUT = {
  familyReferenceId: '5b21ca75-1c11-4c2e-9d3b-111111111111',
  profileIds: ['5b21ca75-1c11-4c2e-9d3b-222222222222'],
  reason: 'Moved away',
}

describe('WithdrawChildrenSchema reason fields', () => {
  it('accepts a preset reason without a note', () => {
    expect(WithdrawChildrenSchema.safeParse(VALID_INPUT).success).toBe(true)
  })

  it('rejects a reason outside the preset list', () => {
    const result = WithdrawChildrenSchema.safeParse({
      ...VALID_INPUT,
      reason: 'Because',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing reason', () => {
    const { reason: _reason, ...rest } = VALID_INPUT
    expect(WithdrawChildrenSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a note longer than 200 chars', () => {
    const result = WithdrawChildrenSchema.safeParse({
      ...VALID_INPUT,
      note: 'x'.repeat(201),
    })
    expect(result.success).toBe(false)
  })
})

describe('formatWithdrawalReason', () => {
  it('returns the preset alone when there is no note', () => {
    expect(formatWithdrawalReason('Financial')).toBe('Financial')
  })

  it('joins preset and note with a colon', () => {
    expect(formatWithdrawalReason('Other', 'moving abroad')).toBe(
      'Other: moving abroad'
    )
  })

  it('ignores an empty note', () => {
    expect(formatWithdrawalReason('Financial', '  ')).toBe('Financial')
  })
})

describe('WITHDRAWAL_REASONS', () => {
  it('stays distinct from system reason strings', () => {
    expect(WITHDRAWAL_REASONS).not.toContain('Withdrawn by admin')
    expect(WITHDRAWAL_REASONS).not.toContain('Subscription canceled')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test lib/validations/__tests__/dugsi.test.ts`
Expected: FAIL — `WITHDRAWAL_REASONS` and `formatWithdrawalReason` do not exist.

- [ ] **Step 3: Implement**

In `lib/constants/dugsi.ts` add:

```ts
export const WITHDRAWAL_REASONS = [
  'Moved away',
  'Schedule conflict',
  'Financial',
  'Switched program',
  'Other',
] as const
```

In `lib/validations/dugsi.ts` add the import and extend the schema (leave `WithdrawalPreviewSchema` unchanged — preview needs no reason):

```ts
import { SHIFT_FILTER_ALL, WITHDRAWAL_REASONS } from '@/lib/constants/dugsi'

export const WithdrawChildrenSchema = z.object({
  familyReferenceId: z.string().uuid('Invalid family reference ID format'),
  profileIds: z
    .array(z.string().uuid('Invalid profile ID format'))
    .min(1, 'At least one child must be selected for withdrawal')
    .max(50, 'Too many children selected')
    .refine(uniqueProfileIds, 'Duplicate children selected'),
  reason: z.enum(WITHDRAWAL_REASONS, {
    errorMap: () => ({ message: 'Select a withdrawal reason' }),
  }),
  note: z.string().max(200, 'Note is too long').optional(),
})

export function formatWithdrawalReason(reason: string, note?: string): string {
  const trimmed = note?.trim()
  return trimmed ? `${reason}: ${trimmed}` : reason
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test lib/validations/__tests__/dugsi.test.ts`
Expected: PASS. Then `bunx tsc --noEmit` — expect errors in `withdrawal-actions.ts` callers only if they construct the schema input; fix nothing else yet (Task 5 wires the action). If tsc fails on the action, add `reason` plumbing there in Task 5, not here; if it fails because tests call the action, defer. If tsc is clean, continue.

Note: `withdrawal-actions.ts` destructures `parsedInput` — adding required `reason` breaks its type until Task 5. If `bunx tsc --noEmit` fails on that file, proceed to Task 5 before committing tsc-clean state, or wire the pass-through minimally here: `const { familyReferenceId, profileIds } = parsedInput` still typechecks (extra fields are fine). Verify and continue.

- [ ] **Step 5: Commit**

```bash
git add lib/constants/dugsi.ts lib/validations/dugsi.ts lib/validations/__tests__/dugsi.test.ts
git commit -m "feat(dugsi): withdrawal reason presets and schema"
```

---

### Task 2: Extract shared Stripe pricing helper

**Files:**

- Create: `lib/services/dugsi/subscription-pricing.ts`
- Modify: `lib/services/dugsi/withdrawal-service.ts` (replace the inline retrieve/guards/update block in the not-all-withdrawn branch)
- Test: `lib/services/dugsi/__tests__/subscription-pricing.test.ts`

**Interfaces:**

- Consumes: `getDugsiKeys()` from `@/lib/keys/stripe`; `getStripeInterval`, `formatRateDisplay`, `getRateTierDescription` from `@/lib/utils/dugsi-tuition`; `ActionError`, `ERROR_CODES`.
- Produces:

```ts
export interface RosterChild {
  id: string
  name: string
}

export async function updateDugsiSubscriptionPricing(
  stripe: Stripe,
  stripeSubscriptionId: string,
  newRate: number,
  roster: RosterChild[],
  options?: { clearCancelAtPeriodEnd?: boolean }
): Promise<void>
```

Behavior: retrieve subscription; throw `ActionError('Subscription has no line items to update', ERROR_CODES.STRIPE_ERROR)` when no item; throw `ActionError('Stripe product not configured for Dugsi', ERROR_CODES.STRIPE_ERROR)` when `getDugsiKeys().productId` missing; update item `price_data` `{product, unit_amount: newRate, currency: 'usd', recurring: getStripeInterval()}`, `proration_behavior: 'none'`, metadata `{Children: names joined ', ', Rate: formatRateDisplay(newRate), Tier: getRateTierDescription(roster.length), childCount: String(roster.length), calculatedRate: String(newRate), profileIds: ids joined ','}`; include `cancel_at_period_end: false` in the update ONLY when `options.clearCancelAtPeriodEnd` is true AND the retrieved subscription has `cancel_at_period_end === true`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/services/dugsi/__tests__/subscription-pricing.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updateDugsiSubscriptionPricing } from '../subscription-pricing'

const { mockRetrieve, mockUpdate } = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/keys/stripe', () => ({
  getDugsiKeys: () => ({ productId: 'prod_test' }),
}))

const stripe = {
  subscriptions: { retrieve: mockRetrieve, update: mockUpdate },
} as never

const ROSTER = [
  { id: 'p1', name: 'Aisha' },
  { id: 'p2', name: 'Omar' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockRetrieve.mockResolvedValue({
    cancel_at_period_end: false,
    items: { data: [{ id: 'si_1' }] },
  })
  mockUpdate.mockResolvedValue({})
})

describe('updateDugsiSubscriptionPricing', () => {
  it('updates price and full metadata block', async () => {
    await updateDugsiSubscriptionPricing(stripe, 'sub_1', 16000, ROSTER)
    expect(mockUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        proration_behavior: 'none',
        items: [
          expect.objectContaining({
            id: 'si_1',
            price_data: expect.objectContaining({
              product: 'prod_test',
              unit_amount: 16000,
              currency: 'usd',
            }),
          }),
        ],
        metadata: expect.objectContaining({
          Children: 'Aisha, Omar',
          childCount: '2',
          calculatedRate: '16000',
          profileIds: 'p1,p2',
        }),
      })
    )
  })

  it('does not touch cancel_at_period_end by default', async () => {
    mockRetrieve.mockResolvedValueOnce({
      cancel_at_period_end: true,
      items: { data: [{ id: 'si_1' }] },
    })
    await updateDugsiSubscriptionPricing(stripe, 'sub_1', 16000, ROSTER)
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty(
      'cancel_at_period_end'
    )
  })

  it('clears cancel_at_period_end when asked and set', async () => {
    mockRetrieve.mockResolvedValueOnce({
      cancel_at_period_end: true,
      items: { data: [{ id: 'si_1' }] },
    })
    await updateDugsiSubscriptionPricing(stripe, 'sub_1', 16000, ROSTER, {
      clearCancelAtPeriodEnd: true,
    })
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({
      cancel_at_period_end: false,
    })
  })

  it('omits cancel flag when asked but not set', async () => {
    await updateDugsiSubscriptionPricing(stripe, 'sub_1', 16000, ROSTER, {
      clearCancelAtPeriodEnd: true,
    })
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty(
      'cancel_at_period_end'
    )
  })

  it('throws STRIPE_ERROR when subscription has no items', async () => {
    mockRetrieve.mockResolvedValueOnce({ items: { data: [] } })
    await expect(
      updateDugsiSubscriptionPricing(stripe, 'sub_1', 16000, ROSTER)
    ).rejects.toThrow('no line items')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test lib/services/dugsi/__tests__/subscription-pricing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// lib/services/dugsi/subscription-pricing.ts
import type Stripe from 'stripe'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { getDugsiKeys } from '@/lib/keys/stripe'
import {
  formatRateDisplay,
  getRateTierDescription,
  getStripeInterval,
} from '@/lib/utils/dugsi-tuition'

export interface RosterChild {
  id: string
  name: string
}

export async function updateDugsiSubscriptionPricing(
  stripe: Stripe,
  stripeSubscriptionId: string,
  newRate: number,
  roster: RosterChild[],
  options?: { clearCancelAtPeriodEnd?: boolean }
): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
  const subscriptionItemId = subscription.items.data[0]?.id
  if (!subscriptionItemId) {
    throw new ActionError(
      'Subscription has no line items to update',
      ERROR_CODES.STRIPE_ERROR
    )
  }

  const { productId } = getDugsiKeys()
  if (!productId) {
    throw new ActionError(
      'Stripe product not configured for Dugsi',
      ERROR_CODES.STRIPE_ERROR
    )
  }

  const params: Stripe.SubscriptionUpdateParams = {
    items: [
      {
        id: subscriptionItemId,
        price_data: {
          product: productId,
          unit_amount: newRate,
          currency: 'usd',
          recurring: getStripeInterval(),
        },
      },
    ],
    proration_behavior: 'none',
    metadata: {
      Children: roster.map((c) => c.name).join(', '),
      Rate: formatRateDisplay(newRate),
      Tier: getRateTierDescription(roster.length),
      childCount: String(roster.length),
      calculatedRate: String(newRate),
      profileIds: roster.map((c) => c.id).join(','),
    },
  }

  if (options?.clearCancelAtPeriodEnd && subscription.cancel_at_period_end) {
    params.cancel_at_period_end = false
  }

  await stripe.subscriptions.update(stripeSubscriptionId, params)
}
```

- [ ] **Step 4: Refactor withdrawal-service to use it**

In `lib/services/dugsi/withdrawal-service.ts`, inside the Stripe `try`, replace the entire `else` branch (the retrieve → item guard → product guard → `stripe.subscriptions.update(...)` block, currently ~lines 341-384 in the not-all-withdrawn path) with:

```ts
} else {
  await updateDugsiSubscriptionPricing(
    stripe,
    subscription.stripeSubscriptionId,
    newRate,
    remainingProfiles.map((p) => ({ id: p.id, name: p.name }))
  )
}
```

Import `updateDugsiSubscriptionPricing` from `./subscription-pricing`. Remove now-unused imports (`getDugsiKeys`, `getStripeInterval`, `formatRateDisplay`, `getRateTierDescription` — keep any still used elsewhere in the file; `formatRateDisplay`/`getRateTierDescription` are only used in that block, `calculateDugsiRate` stays). The all-withdrawn `cancel_at_period_end: true` branch stays exactly as-is.

- [ ] **Step 5: Run helper tests and the withdrawal regression suite**

Run: `bun run test lib/services/dugsi/__tests__/subscription-pricing.test.ts lib/services/dugsi/__tests__/withdrawal-service.test.ts`
Expected: both PASS unchanged (the withdrawal suite mocks the stripe client module, and the helper uses the same client object — verify the suite's `mockStripeSubscriptionRetrieve`/`mockStripeSubscriptionUpdate` still intercept; if the suite mocks `@/lib/stripe-dugsi`, nothing changes). Then `bunx tsc --noEmit` and `bunx eslint lib/services/dugsi/ --fix`.

- [ ] **Step 6: Commit**

```bash
git add lib/services/dugsi/subscription-pricing.ts lib/services/dugsi/withdrawal-service.ts lib/services/dugsi/__tests__/subscription-pricing.test.ts
git commit -m "refactor(dugsi): extract shared subscription pricing helper"
```

---

### Task 3: Query-layer additions for billing sync

**Files:**

- Modify: `lib/db/queries/billing.ts`
- Modify: `lib/db/queries/enrollment.ts`
- Test: covered by service tests in Tasks 4 and 6 (query fns are thin Prisma wrappers; the project tests them through service mocks — follow that convention, do not add a Prisma-integration test here)

**Interfaces:**

- Produces (in `lib/db/queries/billing.ts`, matching the file's existing style — `client: DatabaseClient = prisma` last param):

```ts
export async function getActiveBillingAssignmentsForSubscription(
  subscriptionId: string,
  client: DatabaseClient = prisma
): Promise<{ id: string; programProfileId: string; amount: number }[]>
// billingAssignment.findMany({ where: { subscriptionId, isActive: true },
//   select: { id: true, programProfileId: true, amount: true } })

export async function createBillingAssignment(
  data: { subscriptionId: string; programProfileId: string; amount: number },
  client: DatabaseClient = prisma
): Promise<{ id: string }>
// billingAssignment.create({ data: { ...data, isActive: true }, select: { id: true } })
```

- Produces (in `lib/db/queries/enrollment.ts`):

```ts
export async function createRegisteredEnrollment(
  programProfileId: string,
  startDate: Date,
  client: DatabaseClient = prisma
): Promise<{ id: string }>
// enrollment.create({ data: { programProfileId, status: 'REGISTERED', startDate }, select: { id: true } })
```

- [ ] **Step 1: Implement the three query functions** exactly as the comments above describe, matching the import style and `DatabaseClient` type already used in each file.

- [ ] **Step 2: Verify**

Run: `bunx tsc --noEmit && bunx eslint lib/db/queries/billing.ts lib/db/queries/enrollment.ts`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/db/queries/billing.ts lib/db/queries/enrollment.ts
git commit -m "feat(dugsi): query helpers for billing sync and re-enrollment"
```

---

### Task 4: `syncFamilyBillingRate` service

**Files:**

- Create: `lib/services/dugsi/billing-sync-service.ts`
- Modify: `lib/services/dugsi/index.ts` (export)
- Test: `lib/services/dugsi/__tests__/billing-sync-service.test.ts`

**Interfaces:**

- Consumes: `findFamilySubscription`, `findLiveFamilySubscriptionIds`, `handleBillingDivergence` from `./billing-helpers`; `findFamilyProfilesForWithdrawal` from `@/lib/db/queries/program-profile` (reused as the roster query — same REGISTERED/ENROLLED filter, includes `person.name`); Task 3 queries; `updateBillingAssignmentAmount`, `updateSubscriptionAmount` from `@/lib/db/queries/billing`; `updateDugsiSubscriptionPricing` from `./subscription-pricing`; `calculateDugsiRate` from `@/lib/utils/dugsi-tuition`; `calculateSplitAmounts` from `@/lib/services/shared/billing-service`; `getDugsiStripeClient` from `@/lib/stripe-dugsi`; `prisma` from `@/lib/db`.
- Produces:

```ts
export interface SyncFamilyBillingResult {
  synced: boolean
  rate: number
  childCount: number
  warning?: string
}

export async function syncFamilyBillingRate(
  familyReferenceId: string
): Promise<SyncFamilyBillingResult>
```

Flow (spec section 2): multi-sub guard 409 → roster via `findFamilyProfilesForWithdrawal(familyReferenceId, DUGSI_PROGRAM, ['REGISTERED','ENROLLED'])` → rate = `calculateDugsiRate(roster.length)` → `findFamilySubscription`; none → `{synced: false, rate, childCount, warning: 'No active subscription — family needs a new checkout'}` → roster empty → same no-op shape with warning `'No active children — nothing to sync'` (never cancel here; withdrawal owns cancellation) → splits = `calculateSplitAmounts(rate, roster.length)`, any share <= 0 → throw INVALID_INPUT before any write → override warning when `subscription.amount !== rate` and `subscription.amount !== calculateDugsiRate(<previous count>)` is unknowable, so simply: warning when `subscription.amount !== rate` and existing amount is not a calculated tier — implement as: `overrideWarning` when `subscription.amount !== calculateDugsiRate(existingAssignmentCount)` where `existingAssignmentCount` is the count of active assignments; attach `'Admin override was replaced by the calculated rate'` → Stripe: `updateDugsiSubscriptionPricing(stripe, subscription.stripeSubscriptionId, rate, roster, { clearCancelAtPeriodEnd: true })`; Stripe throw → rethrow as `ActionError('Stripe billing update failed. Roster is saved; use Recalculate rate to retry.', ERROR_CODES.STRIPE_ERROR)` (callers catch and downgrade to warning) → DB txn: for each roster child with an active assignment, `updateBillingAssignmentAmount(assignment.id, share, tx)`; for each without, `createBillingAssignment({subscriptionId: subscription.id, programProfileId, amount: share}, tx)`; `updateSubscriptionAmount(subscription.id, rate, tx)` → txn throw → `handleBillingDivergence(...)` and return `{synced: true, rate, childCount, warning: <divergence message>}`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/services/dugsi/__tests__/billing-sync-service.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { syncFamilyBillingRate } from '../billing-sync-service'

const {
  mockFindFamilySubscription,
  mockFindLiveFamilySubscriptionIds,
  mockHandleBillingDivergence,
  mockFindFamilyProfilesForWithdrawal,
  mockGetActiveAssignmentsForSubscription,
  mockCreateBillingAssignment,
  mockUpdateBillingAssignmentAmount,
  mockUpdateSubscriptionAmount,
  mockUpdatePricing,
} = vi.hoisted(() => ({
  mockFindFamilySubscription: vi.fn(),
  mockFindLiveFamilySubscriptionIds: vi.fn(),
  mockHandleBillingDivergence: vi.fn(),
  mockFindFamilyProfilesForWithdrawal: vi.fn(),
  mockGetActiveAssignmentsForSubscription: vi.fn(),
  mockCreateBillingAssignment: vi.fn(),
  mockUpdateBillingAssignmentAmount: vi.fn(),
  mockUpdateSubscriptionAmount: vi.fn(),
  mockUpdatePricing: vi.fn(),
}))

vi.mock('../billing-helpers', () => ({
  findFamilySubscription: mockFindFamilySubscription,
  findLiveFamilySubscriptionIds: mockFindLiveFamilySubscriptionIds,
  handleBillingDivergence: mockHandleBillingDivergence,
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  findFamilyProfilesForWithdrawal: mockFindFamilyProfilesForWithdrawal,
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getActiveBillingAssignmentsForSubscription:
    mockGetActiveAssignmentsForSubscription,
  createBillingAssignment: mockCreateBillingAssignment,
  updateBillingAssignmentAmount: mockUpdateBillingAssignmentAmount,
  updateSubscriptionAmount: mockUpdateSubscriptionAmount,
}))

vi.mock('../subscription-pricing', () => ({
  updateDugsiSubscriptionPricing: mockUpdatePricing,
}))

vi.mock('@/lib/stripe-dugsi', () => ({
  getDugsiStripeClient: () => ({}) as never,
}))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: (fn: (tx: string) => unknown) => fn('tx-client') },
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({}),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
}))

const FAMILY = 'fam-1'
const SUB = {
  id: 'sub-db-1',
  stripeSubscriptionId: 'sub_stripe1',
  amount: 16000,
  status: 'active',
}

const profiles = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    status: 'ENROLLED',
    person: { name: `Child ${i + 1}` },
  }))

beforeEach(() => {
  vi.clearAllMocks()
  mockFindLiveFamilySubscriptionIds.mockResolvedValue(['sub-db-1'])
  mockFindFamilySubscription.mockResolvedValue(SUB)
  mockFindFamilyProfilesForWithdrawal.mockResolvedValue(profiles(2))
  mockGetActiveAssignmentsForSubscription.mockResolvedValue([
    { id: 'a1', programProfileId: 'p1', amount: 8000 },
    { id: 'a2', programProfileId: 'p2', amount: 8000 },
  ])
  mockUpdatePricing.mockResolvedValue(undefined)
})

describe('syncFamilyBillingRate', () => {
  it('re-splits existing assignments to the calculated rate', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(profiles(3))
    mockGetActiveAssignmentsForSubscription.mockResolvedValueOnce([
      { id: 'a1', programProfileId: 'p1', amount: 8000 },
      { id: 'a2', programProfileId: 'p2', amount: 8000 },
      { id: 'a3', programProfileId: 'p3', amount: 7000 },
    ])
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.rate).toBe(23000)
    expect(mockUpdatePricing).toHaveBeenCalledWith(
      expect.anything(),
      'sub_stripe1',
      23000,
      expect.arrayContaining([expect.objectContaining({ id: 'p1' })]),
      { clearCancelAtPeriodEnd: true }
    )
    expect(mockUpdateBillingAssignmentAmount).toHaveBeenCalledTimes(3)
    expect(mockUpdateSubscriptionAmount).toHaveBeenCalledWith(
      'sub-db-1',
      23000,
      'tx-client'
    )
  })

  it('creates assignments for roster children without one', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(profiles(3))
    const result = await syncFamilyBillingRate(FAMILY)
    expect(mockCreateBillingAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub-db-1',
        programProfileId: 'p3',
      }),
      'tx-client'
    )
    expect(result.synced).toBe(true)
  })

  it('assignment shares sum exactly to the rate', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(profiles(3))
    mockGetActiveAssignmentsForSubscription.mockResolvedValueOnce([])
    await syncFamilyBillingRate(FAMILY)
    const total = mockCreateBillingAssignment.mock.calls.reduce(
      (sum, [data]) => sum + data.amount,
      0
    )
    expect(total).toBe(23000)
  })

  it('refuses when family has multiple live subscriptions', async () => {
    mockFindLiveFamilySubscriptionIds.mockResolvedValueOnce(['s1', 's2'])
    await expect(syncFamilyBillingRate(FAMILY)).rejects.toThrow(
      /multiple active subscriptions/i
    )
    expect(mockUpdatePricing).not.toHaveBeenCalled()
  })

  it('no-ops with warning when family has no subscription', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(null)
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.synced).toBe(false)
    expect(result.warning).toMatch(/no active subscription/i)
    expect(mockUpdatePricing).not.toHaveBeenCalled()
  })

  it('no-ops with warning when roster is empty', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce([])
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.synced).toBe(false)
    expect(mockUpdatePricing).not.toHaveBeenCalled()
  })

  it('warns when replacing an admin override', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce({
      ...SUB,
      amount: 20000,
    })
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.warning).toMatch(/override/i)
    expect(mockUpdatePricing).toHaveBeenCalled()
  })

  it('throws STRIPE_ERROR when the Stripe update fails, before any DB write', async () => {
    mockUpdatePricing.mockRejectedValueOnce(new Error('stripe down'))
    await expect(syncFamilyBillingRate(FAMILY)).rejects.toThrow(
      /Recalculate rate/
    )
    expect(mockUpdateBillingAssignmentAmount).not.toHaveBeenCalled()
    expect(mockUpdateSubscriptionAmount).not.toHaveBeenCalled()
  })

  it('returns divergence warning when DB fails after Stripe success', async () => {
    mockUpdateSubscriptionAmount.mockRejectedValueOnce(new Error('db down'))
    mockHandleBillingDivergence.mockResolvedValueOnce(
      'Stripe updated but DB update failed. Check logs for details.'
    )
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.synced).toBe(true)
    expect(result.warning).toMatch(/DB update failed/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test lib/services/dugsi/__tests__/billing-sync-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

```ts
// lib/services/dugsi/billing-sync-service.ts
import { EnrollmentStatus } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  createBillingAssignment,
  getActiveBillingAssignmentsForSubscription,
  updateBillingAssignmentAmount,
  updateSubscriptionAmount,
} from '@/lib/db/queries/billing'
import { findFamilyProfilesForWithdrawal } from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError, logInfo } from '@/lib/logger'
import { calculateSplitAmounts } from '@/lib/services/shared/billing-service'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'

import {
  findFamilySubscription,
  findLiveFamilySubscriptionIds,
  handleBillingDivergence,
} from './billing-helpers'
import { updateDugsiSubscriptionPricing } from './subscription-pricing'

const logger = createServiceLogger('dugsi-billing-sync')

const ROSTER_STATUSES: EnrollmentStatus[] = ['REGISTERED', 'ENROLLED']

export interface SyncFamilyBillingResult {
  synced: boolean
  rate: number
  childCount: number
  warning?: string
}

export async function syncFamilyBillingRate(
  familyReferenceId: string
): Promise<SyncFamilyBillingResult> {
  const liveSubscriptionIds =
    await findLiveFamilySubscriptionIds(familyReferenceId)
  if (liveSubscriptionIds.length > 1) {
    throw new ActionError(
      'This family has multiple active subscriptions. Consolidate billing before recalculating.',
      ERROR_CODES.ACTIVE_SUBSCRIPTION,
      undefined,
      409
    )
  }

  const roster = await findFamilyProfilesForWithdrawal(
    familyReferenceId,
    DUGSI_PROGRAM,
    ROSTER_STATUSES
  )
  const childCount = roster.length
  const rate = calculateDugsiRate(childCount)

  if (childCount === 0) {
    return {
      synced: false,
      rate,
      childCount,
      warning: 'No active children — nothing to sync',
    }
  }

  const subscription = await findFamilySubscription(familyReferenceId)
  if (!subscription) {
    return {
      synced: false,
      rate,
      childCount,
      warning: 'No active subscription — family needs a new checkout',
    }
  }

  const splits = calculateSplitAmounts(rate, childCount)
  if (splits.some((amount) => amount <= 0)) {
    throw new ActionError(
      'Calculated rate would create zero-amount billing assignments',
      ERROR_CODES.INVALID_INPUT
    )
  }

  const existingAssignments = await getActiveBillingAssignmentsForSubscription(
    subscription.id
  )
  const overrideWarning =
    subscription.amount !== rate &&
    subscription.amount !== calculateDugsiRate(existingAssignments.length)
      ? 'Admin override was replaced by the calculated rate'
      : undefined

  const stripe = getDugsiStripeClient()
  try {
    await updateDugsiSubscriptionPricing(
      stripe,
      subscription.stripeSubscriptionId,
      rate,
      roster.map((p) => ({ id: p.id, name: p.person.name })),
      { clearCancelAtPeriodEnd: true }
    )
  } catch (error) {
    await logError(logger, error, 'Stripe update failed during billing sync', {
      familyReferenceId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      intendedAmount: rate,
    })
    throw new ActionError(
      'Stripe billing update failed. Roster is saved; use Recalculate rate to retry.',
      ERROR_CODES.STRIPE_ERROR
    )
  }

  try {
    await prisma.$transaction(async (tx) => {
      const byProfile = new Map(
        existingAssignments.map((a) => [a.programProfileId, a])
      )
      for (const [index, profile] of roster.entries()) {
        const share = splits[index]
        const existing = byProfile.get(profile.id)
        if (existing) {
          await updateBillingAssignmentAmount(existing.id, share, tx)
        } else {
          await createBillingAssignment(
            {
              subscriptionId: subscription.id,
              programProfileId: profile.id,
              amount: share,
            },
            tx
          )
        }
      }
      await updateSubscriptionAmount(subscription.id, rate, tx)
    })
  } catch (dbError) {
    const warning = await handleBillingDivergence(
      logger,
      dbError,
      `Stripe updated to ${rate} cents`,
      {
        familyReferenceId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        intendedAmount: rate,
      }
    )
    return { synced: true, rate, childCount, warning }
  }

  await logInfo(logger, 'Family billing rate synced', {
    familyReferenceId,
    childCount,
    rate,
  })

  return { synced: true, rate, childCount, warning: overrideWarning }
}
```

Note for implementer: check `handleBillingDivergence`'s actual signature in `lib/services/dugsi/billing-helpers.ts` before wiring — match how `withdrawal-service.ts` calls it (return value is the sanitized warning string or an object; mirror the withdrawal usage exactly, including whether the result needs `.warning`). Adjust the test's mock return to the real shape. Add the export to `lib/services/dugsi/index.ts` alongside the withdrawal exports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test lib/services/dugsi/__tests__/billing-sync-service.test.ts`
Expected: PASS. Then `bunx tsc --noEmit && bunx eslint lib/services/dugsi/ --fix`.

- [ ] **Step 5: Commit**

```bash
git add lib/services/dugsi/billing-sync-service.ts lib/services/dugsi/index.ts lib/services/dugsi/__tests__/billing-sync-service.test.ts
git commit -m "feat(dugsi): syncFamilyBillingRate service"
```

---

### Task 5: Withdrawal reason plumbing (service + action + dialog)

**Files:**

- Modify: `lib/services/dugsi/withdrawal-service.ts` (accept reason param)
- Modify: `app/admin/dugsi/withdrawal-actions.ts` (pass formatted reason)
- Modify: `app/admin/dugsi/components/dialogs/withdraw-dialog.tsx` (reason Select + note Textarea)
- Test: extend `lib/services/dugsi/__tests__/withdrawal-service.test.ts`

**Interfaces:**

- Consumes: Task 1's `formatWithdrawalReason`, `WITHDRAWAL_REASONS`.
- Produces: `withdrawChildren(familyReferenceId: string, requestedProfileIds: string[], reason?: string)` — default stays `'Withdrawn by admin'`; the action calls `withdrawChildren(familyReferenceId, profileIds, formatWithdrawalReason(reason, note))`.

- [ ] **Step 1: Write the failing test** (add to the withdrawal suite)

```ts
it('passes the provided reason to enrollment withdrawal', async () => {
  mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
    createMockProfiles(2)
  )
  mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
  mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
    items: { data: [{ id: 'si_item1' }] },
  })

  await withdrawChildren(FAMILY_ID, ['profile-1'], 'Financial: tuition cost')

  expect(mockWithdrawEnrollmentsByIds).toHaveBeenCalledWith(
    expect.any(Array),
    'Financial: tuition cost',
    expect.any(Date),
    'tx-client'
  )
})

it('defaults the reason when none is provided', async () => {
  mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
    createMockProfiles(2)
  )
  mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
  mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
    items: { data: [{ id: 'si_item1' }] },
  })

  await withdrawChildren(FAMILY_ID, ['profile-1'])

  expect(mockWithdrawEnrollmentsByIds).toHaveBeenCalledWith(
    expect.any(Array),
    'Withdrawn by admin',
    expect.any(Date),
    'tx-client'
  )
})
```

(Adjust the Stripe retrieve mock if Task 2's refactor changed which mock intercepts — mirror the existing rate-update tests in the suite.)

- [ ] **Step 2: Run to verify the first test fails** (`withdrawChildren` has no third param yet).

Run: `bun run test lib/services/dugsi/__tests__/withdrawal-service.test.ts`

- [ ] **Step 3: Implement**

In `withdrawal-service.ts`: change the signature to `withdrawChildren(familyReferenceId: string, requestedProfileIds: string[], reason: string = WITHDRAWAL_REASON)` and pass `reason` where `WITHDRAWAL_REASON` is currently passed to `withdrawEnrollmentsByIds`.

In `withdrawal-actions.ts` `_withdrawChildrenAction`:

```ts
const { familyReferenceId, profileIds, reason, note } = parsedInput
const result = await withdrawChildren(
  familyReferenceId,
  profileIds,
  formatWithdrawalReason(reason, note)
)
```

In `withdraw-dialog.tsx`: add local state `reason` (default `''`) and `note`; a required `Select` over `WITHDRAWAL_REASONS` and an optional note input (`Textarea`, `maxLength={200}`) rendered above the confirm button; disable confirm until `reason` is set; include `reason` and `note` in the `withdrawChildrenAction` call; reset both on close. Follow the dialog's existing shadcn component usage for Select/Textarea imports.

- [ ] **Step 4: Verify**

Run: `bun run test lib/services/dugsi/__tests__/withdrawal-service.test.ts lib/validations/__tests__/dugsi.test.ts`
Expected: PASS. Then `bunx tsc --noEmit && bunx eslint app/admin/dugsi lib/services/dugsi --fix`.

- [ ] **Step 5: Commit**

```bash
git add lib/services/dugsi/withdrawal-service.ts app/admin/dugsi/withdrawal-actions.ts app/admin/dugsi/components/dialogs/withdraw-dialog.tsx lib/services/dugsi/__tests__/withdrawal-service.test.ts
git commit -m "feat(dugsi): withdrawal reason capture through dialog and service"
```

---

### Task 6: `reEnrollChild` service + action

**Files:**

- Modify: `lib/services/dugsi/family-service.ts` (add `reEnrollChild`)
- Modify: `lib/validations/dugsi.ts` (add `ReEnrollChildSchema`)
- Modify: `app/admin/dugsi/actions.ts` (add `reEnrollChild` action, following the `_addChildToFamily` pattern)
- Test: `lib/services/dugsi/__tests__/re-enroll.test.ts`

**Interfaces:**

- Consumes: `getProgramProfileById` from `@/lib/db/queries/program-profile` (already imported by family-service); `updateProgramProfileStatus` from same; `createRegisteredEnrollment` (Task 3); `syncFamilyBillingRate` (Task 4); `prisma.$transaction`.
- Produces:

```ts
export async function reEnrollChild(
  profileId: string
): Promise<{ childId: string; warning?: string }>
```

```ts
export const ReEnrollChildSchema = z.object({
  profileId: z.string().uuid('Invalid profile ID format'),
})
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/services/dugsi/__tests__/re-enroll.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reEnrollChild } from '../family-service'

const { mockGetProfile, mockUpdateStatus, mockCreateEnrollment, mockSync } =
  vi.hoisted(() => ({
    mockGetProfile: vi.fn(),
    mockUpdateStatus: vi.fn(),
    mockCreateEnrollment: vi.fn(),
    mockSync: vi.fn(),
  }))

vi.mock('@/lib/db/queries/program-profile', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getProgramProfileById: mockGetProfile,
  updateProgramProfileStatus: mockUpdateStatus,
}))

vi.mock('@/lib/db/queries/enrollment', () => ({
  createRegisteredEnrollment: mockCreateEnrollment,
}))

vi.mock('../billing-sync-service', () => ({
  syncFamilyBillingRate: mockSync,
}))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: (fn: (tx: string) => unknown) => fn('tx-client') },
}))

const WITHDRAWN_PROFILE = {
  id: 'p1',
  program: 'dugsi',
  status: 'WITHDRAWN',
  familyReferenceId: 'fam-1',
  person: { name: 'Aisha' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetProfile.mockResolvedValue(WITHDRAWN_PROFILE)
  mockSync.mockResolvedValue({ synced: true, rate: 16000, childCount: 2 })
})

describe('reEnrollChild', () => {
  it('flips status, creates a fresh enrollment, and syncs billing', async () => {
    const result = await reEnrollChild('p1')
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      'p1',
      'REGISTERED',
      'tx-client'
    )
    expect(mockCreateEnrollment).toHaveBeenCalledWith(
      'p1',
      expect.any(Date),
      'tx-client'
    )
    expect(mockSync).toHaveBeenCalledWith('fam-1')
    expect(result.childId).toBe('p1')
    expect(result.warning).toBeUndefined()
  })

  it('rejects non-WITHDRAWN profiles', async () => {
    mockGetProfile.mockResolvedValueOnce({
      ...WITHDRAWN_PROFILE,
      status: 'ENROLLED',
    })
    await expect(reEnrollChild('p1')).rejects.toThrow(/not withdrawn/i)
    expect(mockUpdateStatus).not.toHaveBeenCalled()
  })

  it('rejects unknown or non-Dugsi profiles', async () => {
    mockGetProfile.mockResolvedValueOnce(null)
    await expect(reEnrollChild('p1')).rejects.toThrow()
  })

  it('keeps the roster change and returns a warning when sync fails', async () => {
    mockSync.mockRejectedValueOnce(new Error('stripe down'))
    const result = await reEnrollChild('p1')
    expect(result.childId).toBe('p1')
    expect(result.warning).toMatch(/billing/i)
  })

  it('propagates sync warnings (e.g. no subscription)', async () => {
    mockSync.mockResolvedValueOnce({
      synced: false,
      rate: 16000,
      childCount: 2,
      warning: 'No active subscription — family needs a new checkout',
    })
    const result = await reEnrollChild('p1')
    expect(result.warning).toMatch(/no active subscription/i)
  })
})
```

(If `family-service.ts`'s existing tests mock these modules differently, align this file's mock set with that suite's pattern — the mock module list must cover everything family-service imports at module load.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test lib/services/dugsi/__tests__/re-enroll.test.ts`
Expected: FAIL — `reEnrollChild` not exported.

- [ ] **Step 3: Implement**

In `family-service.ts`:

```ts
export async function reEnrollChild(
  profileId: string
): Promise<{ childId: string; warning?: string }> {
  const profile = await getProgramProfileById(profileId)
  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }
  if (profile.status !== 'WITHDRAWN') {
    throw new ActionError(
      'Child is not withdrawn and cannot be re-enrolled',
      ERROR_CODES.INVALID_INPUT,
      undefined,
      409
    )
  }
  if (!profile.familyReferenceId) {
    throw new ActionError(
      'Family reference ID not found',
      ERROR_CODES.FAMILY_NOT_FOUND,
      undefined,
      404
    )
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await updateProgramProfileStatus(profileId, 'REGISTERED', tx)
    await createRegisteredEnrollment(profileId, now, tx)
  })

  try {
    const sync = await syncFamilyBillingRate(profile.familyReferenceId)
    return { childId: profileId, warning: sync.warning }
  } catch (error) {
    await logError(logger, error, 'Billing sync failed after re-enrollment', {
      profileId,
      familyReferenceId: profile.familyReferenceId,
    })
    return {
      childId: profileId,
      warning:
        'Child re-enrolled, but the billing update failed. Use Recalculate rate to retry.',
    }
  }
}
```

Match the file's existing imports (`updateProgramProfileStatus` may need adding to the program-profile import; `createRegisteredEnrollment` from `@/lib/db/queries/enrollment`; `syncFamilyBillingRate` from `./billing-sync-service`). Use the file's existing logger instance.

In `app/admin/dugsi/actions.ts`, next to `_addChildToFamily`:

```ts
const _reEnrollChild = rateLimitedAdminActionClient
  .metadata({ actionName: 'reEnrollChild', maxAttempts: 10 })
  .schema(ReEnrollChildSchema)
  .action(async ({ parsedInput }) => {
    const result = await reEnrollChildService(parsedInput.profileId)
    after(() => {
      revalidatePath('/admin/dugsi')
      revalidateTag('dugsi-registrations')
    })
    return result
  })

export async function reEnrollChild(
  ...args: Parameters<typeof _reEnrollChild>
) {
  return _reEnrollChild(...args)
}
```

(Import `reEnrollChild as reEnrollChildService` in the service import block; if the file's other actions use `adminActionClient`, still use `rateLimitedAdminActionClient` per the global constraint, matching `withdrawal-actions.ts`. If `rateLimitedAdminActionClient` is not exported from `@/lib/safe-action`, check `withdrawal-actions.ts` for the exact import it uses and copy it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test lib/services/dugsi/__tests__/re-enroll.test.ts`
Expected: PASS. Then `bunx tsc --noEmit && bunx eslint app/admin/dugsi lib/services/dugsi --fix`. Run any existing family-service test suite to confirm no regressions.

- [ ] **Step 5: Commit**

```bash
git add lib/services/dugsi/family-service.ts lib/validations/dugsi.ts app/admin/dugsi/actions.ts lib/services/dugsi/__tests__/re-enroll.test.ts
git commit -m "feat(dugsi): re-enroll withdrawn child with billing sync"
```

---

### Task 7: `addChildToFamily` billing sync

**Files:**

- Modify: `lib/services/dugsi/family-service.ts:337-431` (`addChildToFamily`)
- Test: `lib/services/dugsi/__tests__/add-child-sync.test.ts` (or extend the existing family-service suite if one covers `addChildToFamily` — check first with `grep -rn "addChildToFamily" lib/services/dugsi/__tests__/`)

**Interfaces:**

- Consumes: `syncFamilyBillingRate` (Task 4).
- Produces: `addChildToFamily(input: NewChildInput): Promise<{ childId: string; warning?: string }>` — return type gains optional `warning`.

- [ ] **Step 1: Write the failing tests** (same mock pattern as Task 6's suite; mock `getProgramProfileById` to return an existing Dugsi profile with `familyReferenceId: 'fam-1'`, guardians present, and mock `prisma.$transaction` to return `{ id: 'new-profile-1' }`):

```ts
it('syncs family billing after adding a child', async () => {
  const result = await addChildToFamily(VALID_INPUT)
  expect(mockSync).toHaveBeenCalledWith('fam-1')
  expect(result.childId).toBe('new-profile-1')
})

it('returns the childId with a warning when sync fails', async () => {
  mockSync.mockRejectedValueOnce(new Error('stripe down'))
  const result = await addChildToFamily(VALID_INPUT)
  expect(result.childId).toBe('new-profile-1')
  expect(result.warning).toMatch(/billing/i)
})
```

Build `VALID_INPUT` from the `NewChildInput` type in family-service (firstName, lastName, gender, gradeLevel, existingStudentId at minimum — copy the exact required fields from the type definition). The `$transaction` mock must return the created profile object since `addChildToFamily` uses its `.id`.

- [ ] **Step 2: Run to verify the first test fails** (no sync call exists).

- [ ] **Step 3: Implement** — at the end of `addChildToFamily`, replace `return { childId: newProfile.id }` with:

```ts
try {
  const sync = await syncFamilyBillingRate(familyId)
  return { childId: newProfile.id, warning: sync.warning }
} catch (error) {
  await logError(logger, error, 'Billing sync failed after adding child', {
    childId: newProfile.id,
    familyReferenceId: familyId,
  })
  return {
    childId: newProfile.id,
    warning:
      'Child added, but the billing update failed. Use Recalculate rate to retry.',
  }
}
```

- [ ] **Step 4: Verify**

Run: `bun run test lib/services/dugsi/` — new tests pass, nothing else breaks. `bunx tsc --noEmit` (the action already passes the service result through, so the added optional field is compatible).

- [ ] **Step 5: Commit**

```bash
git add lib/services/dugsi/family-service.ts lib/services/dugsi/__tests__/add-child-sync.test.ts
git commit -m "feat(dugsi): auto-sync billing when adding a child"
```

---

### Task 8: Recalculate-rate action + UI (button, re-enroll entry point)

**Files:**

- Modify: `app/admin/dugsi/actions.ts` (add `recalculateFamilyRate` action using existing `FamilyBillingControlSchema`)
- Modify: `app/admin/dugsi/components/family-management/detail-tabs/billing-tab.tsx` (Recalculate rate button)
- Modify: `app/admin/dugsi/components/family-management/detail-tabs/overview-tab.tsx` (re-enroll button beside the Withdrawn badge)
- Test: action-level covered by service tests; UI verified by typecheck + existing component test patterns (extend `use-sheet-state`/tab tests only if they already cover buttons — do not introduce a new UI test framework)

**Interfaces:**

- Consumes: `syncFamilyBillingRate` (Task 4), `reEnrollChild` action (Task 6), `FamilyBillingControlSchema` (exists in `lib/validations/dugsi.ts`).
- Produces: `recalculateFamilyRate` server action returning `SyncFamilyBillingResult`.

- [ ] **Step 1: Add the action** (same shape as Task 6's action, `actionName: 'recalculateFamilyRate'`, `maxAttempts: 30`, schema `FamilyBillingControlSchema`, body `syncFamilyBillingRate(parsedInput.familyReferenceId)`).

- [ ] **Step 2: Billing tab button** — in the Subscription section of `billing-tab.tsx`, add an outline `Button` "Recalculate rate" (visible when `family.hasSubscription`), wired via the tab's existing action-handling hook (`useActionHandler` or `useAction` — match the file's current pattern); on success show a toast with the returned `warning` if present, else "Rate synced: $X/mo for N children" using the returned `rate`/`childCount`.

- [ ] **Step 3: Re-enroll entry point** — in `overview-tab.tsx`, next to the `Badge` rendered for non-withdrawable children (the `isWithdrawable ? ... : <Badge>` branch added in PR 245), when `child.status === 'WITHDRAWN'` also render a ghost `Button` (UserPlus icon, title "Re-enroll child") calling the `reEnrollChild` action with `{ profileId: child.id }` via the tab's action-handler pattern; toast the `warning` on success when present. Add an `onReEnrolled` refresh path only if the tab doesn't already refresh via revalidation (it does — `after()` revalidates; no extra prop needed).

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit && bunx eslint app/admin/dugsi --fix && bun run test`
Expected: full suite green.

- [ ] **Step 5: Commit**

```bash
git add app/admin/dugsi/actions.ts app/admin/dugsi/components/family-management/detail-tabs/billing-tab.tsx app/admin/dugsi/components/family-management/detail-tabs/overview-tab.tsx
git commit -m "feat(dugsi): recalculate-rate button and re-enroll entry point"
```

---

### Task 9: Full verification + PR

- [ ] **Step 1:** `bunx tsc --noEmit && bun run test` — everything green (expect ~1470+ tests).
- [ ] **Step 2:** `bunx eslint app/admin/dugsi lib/services/dugsi lib/db/queries lib/validations --fix` — clean.
- [ ] **Step 3:** Push (`git push -u origin roster-lifecycle`, 600000ms timeout — pre-push runs the prod build) and create the PR with the `/create-pr` skill (intent: the spec's Problem section; reference issue 142 follow-up and PR 245).
- [ ] **Step 4:** Run the `security-reviewer` agent on the diff (new admin actions + Stripe writes) and `verify-app` if a dev-server smoke test is feasible; address findings before requesting review.

## Self-Review Notes

- Spec coverage: helper (Task 2), sync incl. un-cancel/no-sub/override/divergence/rule-14 (Task 4), re-enroll (Task 6), add-child (Task 7), reasons end-to-end (Tasks 1, 5), recalc button + actions (Task 8). Re-enroll UI entry point was a spec gap — added in Task 8 and noted here deliberately.
- Type consistency: `SyncFamilyBillingResult`, `RosterChild`, `updateDugsiSubscriptionPricing`, `createRegisteredEnrollment(profileId, startDate, client)`, `createBillingAssignment(data, client)` names match across Tasks 2-8.
- Known verify-at-implementation points (flagged inline): `handleBillingDivergence` return shape (Task 4), withdrawal-suite Stripe mock interception after the helper extraction (Task 2), family-service existing test mock patterns (Tasks 6-7), exact `rateLimitedAdminActionClient` export name (Task 6).
