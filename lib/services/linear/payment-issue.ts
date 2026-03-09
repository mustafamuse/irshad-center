import { StripeAccountType } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'

import { getSubscriptionByStripeId } from '@/lib/db/queries/billing'
import { createServiceLogger } from '@/lib/logger'

import { getLinearClient, isLinearConfigured } from './linear-client'

const logger = createServiceLogger('linear-payment-issues')

const PROGRAM_LABELS: Record<StripeAccountType, string> = {
  MAHAD: 'Mahad',
  DUGSI: 'Dugsi',
  YOUTH_EVENTS: 'Youth Events',
  GENERAL_DONATION: 'Donation',
}

function formatCurrency(amountInCents: number): string {
  return `$${(amountInCents / 100).toFixed(2)}`
}

function extractSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = (
    invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription
    }
  ).subscription
  if (!sub) return null
  return typeof sub === 'string' ? sub : sub.id
}

export async function createPaymentFailureIssue(
  invoice: Stripe.Invoice,
  accountType: StripeAccountType
): Promise<void> {
  if (!isLinearConfigured()) {
    logger.debug('Linear not configured, skipping issue creation')
    return
  }

  try {
    const linear = getLinearClient()
    const teamId = process.env.LINEAR_TEAM_ID!
    const labelId = process.env.LINEAR_PAYMENT_LABEL_ID!

    const stripeSubId = extractSubscriptionId(invoice)
    const program = PROGRAM_LABELS[accountType]
    const amount = formatCurrency(invoice.amount_due)

    let parentName = 'Unknown'
    let parentEmail = ''
    let parentPhone = ''
    let childrenLines: string[] = []

    if (stripeSubId) {
      // Check for existing open issue to avoid duplicates
      const existing = await linear.issues({
        filter: {
          team: { id: { eq: teamId } },
          labels: { id: { eq: labelId } },
          state: { type: { nin: ['completed', 'canceled'] } },
          description: { contains: stripeSubId },
        },
      })

      if (existing.nodes.length > 0) {
        logger.info(
          { stripeSubId, existingIssueId: existing.nodes[0].id },
          'Open Linear issue already exists for this subscription, skipping'
        )
        return
      }

      const subscription = await getSubscriptionByStripeId(stripeSubId)

      if (subscription?.billingAccount?.person) {
        const person = subscription.billingAccount.person
        parentName = person.name
        parentEmail =
          person.contactPoints?.find((cp) => cp.type === 'EMAIL')?.value || ''
        parentPhone =
          person.contactPoints?.find((cp) => cp.type === 'PHONE')?.value || ''
      }

      if (subscription?.assignments) {
        childrenLines = subscription.assignments
          .filter((a) => a.isActive && a.programProfile?.person)
          .map((a) => `- ${a.programProfile.person.name}`)
      }
    }

    const lastError = invoice.last_finalization_error
    const errorDisplay = lastError
      ? `${lastError.code || 'error'} -- ${lastError.message || 'No details'}`
      : 'See Stripe dashboard for details'

    const title = `Payment Failed: ${parentName} -- ${amount} (${program})`
    const priority = (invoice.attempt_count ?? 0) >= 3 ? 1 : 2

    const contactLines = [
      parentEmail ? `| **Email** | ${parentEmail} |` : null,
      parentPhone ? `| **Phone** | ${parentPhone} |` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const hostedUrl = invoice.hosted_invoice_url
    const dashboardUrl = `https://dashboard.stripe.com/invoices/${invoice.id}`

    const description = `## Payment Failure Details

| Field | Value |
|-------|-------|
| **Parent** | ${parentName} |
${contactLines}
| **Program** | ${program} |
| **Amount** | ${amount} |
| **Error** | ${errorDisplay} |
| **Attempt** | ${invoice.attempt_count ?? 1} |

${childrenLines.length > 0 ? `### Children on this subscription\n${childrenLines.join('\n')}` : ''}

### Actions
${hostedUrl ? `- [Retry payment (send to parent)](${hostedUrl})` : ''}
- [View in Stripe Dashboard](${dashboardUrl})

---
*Subscription ID: ${stripeSubId || 'N/A'}*
*Auto-created by payment monitoring system*`

    await linear.createIssue({
      teamId,
      title,
      description,
      priority,
      labelIds: [labelId],
    })

    logger.info(
      { invoiceId: invoice.id, parentName, program },
      'Created Linear issue for payment failure'
    )
  } catch (error) {
    logger.error(
      { error, invoiceId: invoice.id },
      'Failed to create Linear issue'
    )
    Sentry.captureException(error, {
      extra: { invoiceId: invoice.id, accountType },
    })
  }
}

export async function resolvePaymentIssue(
  stripeSubscriptionId: string
): Promise<void> {
  if (!isLinearConfigured()) return

  try {
    const linear = getLinearClient()
    const teamId = process.env.LINEAR_TEAM_ID!
    const labelId = process.env.LINEAR_PAYMENT_LABEL_ID!

    const openIssues = await linear.issues({
      filter: {
        team: { id: { eq: teamId } },
        labels: { id: { eq: labelId } },
        state: { type: { nin: ['completed', 'canceled'] } },
        description: { contains: stripeSubscriptionId },
      },
    })

    if (openIssues.nodes.length === 0) return

    const team = await linear.team(teamId)
    const states = await team.states()
    const doneState = states.nodes.find((s) => s.type === 'completed')

    for (const issue of openIssues.nodes) {
      if (doneState) {
        await issue.update({ stateId: doneState.id })
      }
      await linear.createComment({
        issueId: issue.id,
        body: 'Payment received -- auto-resolved',
      })
      logger.info(
        { issueId: issue.id, stripeSubscriptionId },
        'Auto-resolved Linear payment issue'
      )
    }
  } catch (error) {
    logger.error(
      { error, stripeSubscriptionId },
      'Failed to resolve Linear issue'
    )
    Sentry.captureException(error, {
      extra: { stripeSubscriptionId },
    })
  }
}
