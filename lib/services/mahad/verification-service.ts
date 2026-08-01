import { EnrollmentStatus, SubscriptionStatus } from '@prisma/client'

import {
  findMahadProfileByEmail,
  findMahadProfileById,
  findMahadProfilesByDob,
  type MahadVerificationCandidate,
} from '@/lib/db/queries/mahad-verification'
import { normalizeEmail } from '@/lib/utils/contact-normalization'
import { extractFirstName, normalizeName } from '@/lib/utils/name-normalize'

/**
 * Public-safe view of a Mahad student's current state. Friendly label +
 * detail copy + guidance hint for the UI to render the right CTA.
 */
export type MahadStatusView = {
  kind:
    | 'awaiting_payment_link'
    | 'payment_link_sent'
    | 'payment_confirmed'
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
      if (args.subscriptionStatus === 'active') return PAYMENT_CONFIRMED_VIEW
      if (args.hasStripeCustomer) return PAYMENT_LINK_SENT_VIEW
      return AWAITING_PAYMENT_LINK_VIEW
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
  const matches = candidates.filter((c) => {
    const storedTokens = normalizeName(c.fullName).split(' ').filter(Boolean)
    // Require at least first+last on the stored side too. A single-token
    // stored name (e.g. legacy data with just "Mohammed") would otherwise
    // collapse to first === last and falsely match someone who happened
    // to type that single token in both fields.
    if (storedTokens.length < 2) return false
    const storedFirst = storedTokens[0]!
    const storedLast = storedTokens[storedTokens.length - 1]!
    return storedFirst === inputFirst && storedLast === inputLast
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
