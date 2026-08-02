import { EnrollmentStatus, SubscriptionStatus } from '@prisma/client'

import {
  DOB_CANDIDATE_CAP,
  findMahadProfileByEmail,
  findMahadProfileById,
  findMahadProfilesByDob,
  type MahadVerificationCandidate,
} from '@/lib/db/queries/mahad-verification'
import { createServiceLogger } from '@/lib/logger'
import { normalizeEmail } from '@/lib/utils/contact-normalization'
import { extractFirstName, normalizeName } from '@/lib/utils/name-normalize'

const logger = createServiceLogger('mahad-verification')

/**
 * Public-safe view of a Mahad student's current state. Friendly label +
 * detail copy + guidance hint for the UI to render the right CTA.
 */
export type MahadStatusView = {
  kind:
    | 'awaiting_payment_link'
    | 'payment_link_sent'
    | 'payment_processing'
    | 'payment_confirmed'
    | 'payment_issue'
    | 'payment_canceled'
    | 'on_leave'
    | 'withdrawn'
    | 'completed'
    | 'suspended'
  label: string
  detail: string
  guidance: 'check_whatsapp' | 'contact_admin' | 'none'
}

/**
 * Discriminated union returned by every public verification entry point.
 * Forces callers to narrow on `found === true` before accessing PII-adjacent
 * fields like `firstName`. The union has no full-name field, so leaking the
 * stored surname becomes a compile error.
 */
export type LookupResult =
  | {
      found: true
      profileId: string
      firstName: string
      registeredAt: string // YYYY-MM-DD UTC
      status: MahadStatusView
    }
  | { found: false }

const AWAITING_PAYMENT_LINK_VIEW: MahadStatusView = {
  kind: 'awaiting_payment_link',
  label: 'Awaiting payment link',
  detail:
    'Ustadh Mustafa will message you a payment link via WhatsApp within 1 business day.',
  guidance: 'check_whatsapp',
}

const PAYMENT_LINK_SENT_VIEW: MahadStatusView = {
  kind: 'payment_link_sent',
  label: 'Payment link sent',
  detail:
    'Ustadh Mustafa has sent you a payment link. Check your WhatsApp to complete payment.',
  guidance: 'check_whatsapp',
}

const PAYMENT_CONFIRMED_VIEW: MahadStatusView = {
  kind: 'payment_confirmed',
  label: 'Payment confirmed',
  detail: 'Your enrollment is active. Welcome to Māhad.',
  guidance: 'none',
}

const PAYMENT_PROCESSING_VIEW: MahadStatusView = {
  kind: 'payment_processing',
  label: 'Payment processing',
  detail:
    'Your payment is being processed. Bank payments can take a few business days to clear.',
  guidance: 'none',
}

const PAYMENT_ISSUE_VIEW: MahadStatusView = {
  kind: 'payment_issue',
  label: 'Payment issue',
  detail:
    'There was a problem with your last payment. Please contact Ustadh Mustafa to update your payment method.',
  guidance: 'contact_admin',
}

const PAYMENT_CANCELED_VIEW: MahadStatusView = {
  kind: 'payment_canceled',
  label: 'Subscription canceled',
  detail:
    'Your payment subscription was canceled. Contact Ustadh Mustafa if you would like to re-enroll.',
  guidance: 'contact_admin',
}

const ON_LEAVE_VIEW: MahadStatusView = {
  kind: 'on_leave',
  label: 'On leave',
  detail: 'Your enrollment is currently on leave.',
  guidance: 'contact_admin',
}

const WITHDRAWN_VIEW: MahadStatusView = {
  kind: 'withdrawn',
  label: 'Withdrawn',
  detail: 'You have withdrawn from the program.',
  guidance: 'contact_admin',
}

const COMPLETED_VIEW: MahadStatusView = {
  kind: 'completed',
  label: 'Completed',
  detail: 'You have completed the program.',
  guidance: 'none',
}

const SUSPENDED_VIEW: MahadStatusView = {
  kind: 'suspended',
  label: 'Account paused',
  detail: 'Your enrollment is paused. Please contact admin.',
  guidance: 'contact_admin',
}

/**
 * Pure mapping from current state to friendly view. Single source of truth
 * for what users see — exhaustively testable without a database.
 */
export function deriveStatus(args: {
  enrollmentStatus: EnrollmentStatus
  hasStripeCustomer: boolean
  subscriptionStatus: SubscriptionStatus | null
}): MahadStatusView {
  switch (args.enrollmentStatus) {
    case 'WITHDRAWN':
      return WITHDRAWN_VIEW
    case 'ON_LEAVE':
      return ON_LEAVE_VIEW
    case 'COMPLETED':
      return COMPLETED_VIEW
    case 'SUSPENDED':
      return SUSPENDED_VIEW
    case 'REGISTERED':
    case 'ENROLLED':
      switch (args.subscriptionStatus) {
        case 'active':
        case 'trialing':
          return PAYMENT_CONFIRMED_VIEW
        case 'incomplete':
          return PAYMENT_PROCESSING_VIEW
        case 'past_due':
        case 'unpaid':
        case 'paused':
          return PAYMENT_ISSUE_VIEW
        case 'canceled':
        case 'incomplete_expired':
          return PAYMENT_CANCELED_VIEW
        case null:
          return args.hasStripeCustomer
            ? PAYMENT_LINK_SENT_VIEW
            : AWAITING_PAYMENT_LINK_VIEW
      }
  }
}

export async function lookupByProfileId(
  profileId: string
): Promise<LookupResult> {
  const candidate = await findMahadProfileById(profileId)
  return candidate ? toLookupResult(candidate) : { found: false }
}

export async function lookupByEmail(rawEmail: string): Promise<LookupResult> {
  // Use the same normalizer the write path uses so any future change to
  // canonicalization (e.g. Unicode case-folding) stays in sync end-to-end.
  const normalized = normalizeEmail(rawEmail)
  if (!normalized) return { found: false }
  const candidate = await findMahadProfileByEmail(normalized)
  return candidate ? toLookupResult(candidate) : { found: false }
}

export async function lookupByNameAndDob(input: {
  firstName: string
  lastName: string
  dateOfBirth: Date
}): Promise<LookupResult> {
  const inputTokens = normalizeName(`${input.firstName} ${input.lastName}`)
    .split(' ')
    .filter(Boolean)
  if (inputTokens.length < 2) return { found: false }
  const inputFirst = inputTokens[0]!
  const inputLast = inputTokens[inputTokens.length - 1]!

  const candidates = await findMahadProfilesByDob(input.dateOfBirth)
  if (candidates.length === DOB_CANDIDATE_CAP) {
    // A full page means the cap may have cut off the true match (placeholder
    // DOBs like 1/1 cluster heavily) — a legitimate student would then see
    // not-found nondeterministically. Loud so it surfaces in Axiom.
    logger.warn(
      { cap: DOB_CANDIDATE_CAP },
      'DOB candidate fetch hit cap — lookup may be truncated'
    )
  }
  const matches = candidates.filter((c) => {
    const storedTokens = normalizeName(c.fullName).split(' ').filter(Boolean)
    // Require at least first+last on the stored side too. A single-token
    // stored name (e.g. legacy data with just "Mohammed") would otherwise
    // collapse to first === last and falsely match someone who happened
    // to type that single token in both fields.
    if (storedTokens.length < 2) return false
    // First token must match exactly. The entered "last name" may match ANY
    // later stored token, not just the final one: with Somali three-part
    // names ("Mohamed Abdi Hassan") students routinely enter the patronymic
    // ("Abdi") as their last name. Ambiguity stays safe — multiple hits
    // still resolve to not-found via the exactly-one-match rule below.
    const storedFirst = storedTokens[0]!
    return (
      storedFirst === inputFirst && storedTokens.slice(1).includes(inputLast)
    )
  })

  if (matches.length !== 1) return { found: false }
  return toLookupResult(matches[0]!)
}

function toLookupResult(c: MahadVerificationCandidate): LookupResult {
  return {
    found: true,
    profileId: c.profileId,
    firstName: extractFirstName(c.fullName) || 'there',
    registeredAt: c.registeredAt.toISOString().slice(0, 10),
    status: deriveStatus({
      enrollmentStatus: c.enrollmentStatus,
      hasStripeCustomer: c.hasStripeCustomer,
      subscriptionStatus: c.subscriptionStatus,
    }),
  }
}
