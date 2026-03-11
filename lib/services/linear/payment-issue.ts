import { StripeAccountType } from '@prisma/client'
import type Stripe from 'stripe'

import { getSubscriptionByStripeId } from '@/lib/db/queries/billing'
import { createServiceLogger, logError } from '@/lib/logger'
import { getStripeClient } from '@/lib/utils/stripe-client'

import { getLinearClient, isLinearConfigured } from './linear-client'

const logger = createServiceLogger('linear-payment-issues')

interface LinearIds {
  needsContactStateId: string | null
  unverifiedPaymentStateId: string | null
  paidInFullStateId: string | null
  monthsOwedLabelId: string | null
  oneMonthLabelId: string | null
  twoMonthLabelId: string | null
  threeMonthLabelId: string | null
}

async function getLinearIds(
  linear: ReturnType<typeof getLinearClient>,
  teamId: string
): Promise<LinearIds> {
  const team = await linear.team(teamId)
  const [states, labels] = await Promise.all([team.states(), team.labels()])

  return {
    needsContactStateId:
      states.nodes.find((s) => s.name === 'Needs Contact')?.id ?? null,
    unverifiedPaymentStateId:
      states.nodes.find((s) => s.name === 'Unverified Payment')?.id ?? null,
    paidInFullStateId:
      states.nodes.find((s) => s.name === 'Paid In Full')?.id ?? null,
    monthsOwedLabelId:
      labels.nodes.find((l) => l.name === 'months owed')?.id ?? null,
    oneMonthLabelId: labels.nodes.find((l) => l.name === '1 mo')?.id ?? null,
    twoMonthLabelId: labels.nodes.find((l) => l.name === '2 mo')?.id ?? null,
    threeMonthLabelId: labels.nodes.find((l) => l.name === '3 mo')?.id ?? null,
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[*_`[\]]/g, '')
}

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

function getMonthsOwedLabelIds(
  ids: LinearIds,
  openInvoiceCount: number
): string[] {
  const labelIds: string[] = []
  if (ids.monthsOwedLabelId) labelIds.push(ids.monthsOwedLabelId)

  if (openInvoiceCount >= 3 && ids.threeMonthLabelId) {
    labelIds.push(ids.threeMonthLabelId)
  } else if (openInvoiceCount === 2 && ids.twoMonthLabelId) {
    labelIds.push(ids.twoMonthLabelId)
  } else if (openInvoiceCount === 1 && ids.oneMonthLabelId) {
    labelIds.push(ids.oneMonthLabelId)
  }

  return labelIds
}

async function countOpenInvoices(
  stripeSubId: string,
  accountType: StripeAccountType
): Promise<number> {
  try {
    const stripe = getStripeClient(accountType)
    const invoices = await stripe.invoices.list({
      subscription: stripeSubId,
      status: 'open',
      limit: 10,
    })
    return invoices.data.length
  } catch (error) {
    logger.warn(
      { error, stripeSubId },
      'Failed to count open invoices for months owed label'
    )
    return 0
  }
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
    const safeErrorMsg = (lastError?.message ?? 'No details').replace(
      /\|/g,
      '/'
    )
    const errorDisplay = lastError
      ? `${lastError.code || 'error'} -- ${safeErrorMsg}`
      : 'See Stripe dashboard for details'

    const safeName = sanitizeName(parentName)
    const title = `Payment Failed: ${safeName} -- ${amount} (${program})`
    const attemptCount = invoice.attempt_count ?? 1
    const priority = attemptCount >= 3 ? 1 : 2

    const tableRows = [
      `| **Parent** | ${safeName} |`,
      parentEmail ? `| **Email** | ${parentEmail} |` : null,
      parentPhone ? `| **Phone** | ${parentPhone} |` : null,
      `| **Program** | ${program} |`,
      `| **Amount** | ${amount} |`,
      `| **Error** | ${errorDisplay} |`,
      `| **Attempt** | ${attemptCount} |`,
    ]
      .filter(Boolean)
      .join('\n')

    const hostedUrl = invoice.hosted_invoice_url
    const dashboardUrl = `https://dashboard.stripe.com/invoices/${invoice.id}`

    const messageTemplate = hostedUrl
      ? `### Message to Send Parent
> As-Salamu Alaikum ${safeName}, your ${program} payment of ${amount} was unsuccessful. Please complete your payment here: ${hostedUrl}
> If you have questions, please reply to this message.`
      : ''

    const description = `## Payment Failure Details

| Field | Value |
|-------|-------|
${tableRows}

${childrenLines.length > 0 ? `### Children on this subscription\n${childrenLines.join('\n')}` : ''}

### Actions
${hostedUrl ? `- [Retry payment (send to parent)](${hostedUrl})` : ''}
- [View in Stripe Dashboard](${dashboardUrl})

${messageTemplate}

---
*Subscription ID: ${stripeSubId || 'N/A'}*
*Auto-created by payment monitoring system*`

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (attemptCount >= 3 ? 0 : 2))
    const dueDateStr = dueDate.toISOString().split('T')[0]

    const ids = await getLinearIds(linear, teamId)

    const labelIds = [labelId]
    if (stripeSubId) {
      const openCount = await countOpenInvoices(stripeSubId, accountType)
      if (openCount > 0) {
        labelIds.push(...getMonthsOwedLabelIds(ids, openCount))
      }
    }

    await linear.createIssue({
      teamId,
      title,
      description,
      priority,
      labelIds,
      dueDate: dueDateStr,
      ...(ids.needsContactStateId && { stateId: ids.needsContactStateId }),
    })

    logger.info(
      { invoiceId: invoice.id, parentName, program },
      'Created Linear issue for payment failure'
    )
  } catch (error) {
    await logError(logger, error, 'Failed to create Linear issue', {
      invoiceId: invoice.id,
      accountType,
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

    const ids = await getLinearIds(linear, teamId)

    const [firstIssue, ...remainingIssues] = openIssues.nodes

    if (ids.paidInFullStateId) {
      await firstIssue.update({ stateId: ids.paidInFullStateId })
    }
    await linear.createComment({
      issueId: firstIssue.id,
      body: 'Payment received -- auto-resolved',
    })
    logger.info(
      { issueId: firstIssue.id, stripeSubscriptionId },
      'Auto-resolved Linear payment issue'
    )

    if (remainingIssues.length > 0 && ids.unverifiedPaymentStateId) {
      for (const issue of remainingIssues) {
        await issue.update({ stateId: ids.unverifiedPaymentStateId })
        await linear.createComment({
          issueId: issue.id,
          body: 'Related payment received -- parent may be catching up',
        })
        logger.info(
          { issueId: issue.id, stripeSubscriptionId },
          'Moved Linear issue to Unverified Payment'
        )
      }
    }
  } catch (error) {
    await logError(logger, error, 'Failed to resolve Linear issue', {
      stripeSubscriptionId,
    })
  }
}
