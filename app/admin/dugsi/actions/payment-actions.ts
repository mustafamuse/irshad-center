'use server'

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { ActionError } from '@/lib/errors/action-error'
import { createServiceLogger, logError, logInfo } from '@/lib/logger'
import {
  getAllDugsiRegistrations,
  validateDugsiSubscription as validateDugsiSubscriptionService,
  linkDugsiSubscription as linkDugsiSubscriptionService,
  verifyBankAccount,
  getPaymentStatus,
  createDugsiCheckoutSession,
} from '@/lib/services/dugsi'
import { sendPaymentLink } from '@/lib/services/whatsapp/whatsapp-service'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { createErrorResult } from '@/lib/utils/action-helpers'
import {
  formatPhoneForVCard,
  generateVCardsContent,
  getDateString,
  VCardContact,
  VCardResult,
} from '@/lib/vcard-export'

import type {
  ActionResult,
  SubscriptionValidationData,
  PaymentStatusData,
  BankVerificationData,
  SubscriptionLinkData,
  DugsiRegistration,
  Family,
  StripePaymentHistoryItem,
} from '../_types'

const logger = createServiceLogger('dugsi-payment-actions')

export async function validateDugsiSubscription(
  subscriptionId: string
): Promise<ActionResult<SubscriptionValidationData>> {
  try {
    const result = await validateDugsiSubscriptionService(subscriptionId)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to validate Dugsi subscription', {
      subscriptionId,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to validate subscription',
    }
  }
}

export async function linkDugsiSubscription(params: {
  parentEmail: string
  subscriptionId: string
}): Promise<ActionResult<SubscriptionLinkData>> {
  try {
    const { parentEmail, subscriptionId } = params

    if (!parentEmail || parentEmail.trim() === '') {
      return {
        success: false,
        error: 'Parent email is required to link subscription.',
      }
    }

    const result = await linkDugsiSubscriptionService(
      parentEmail,
      subscriptionId
    )
    revalidatePath('/admin/dugsi')

    await logInfo(logger, 'Dugsi subscription linked', {
      parentEmail,
      subscriptionId,
      studentsUpdated: result.updated,
    })

    return {
      success: true,
      data: result,
      message: `Successfully linked subscription to ${result.updated} students`,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to link Dugsi subscription', {
      parentEmail: params.parentEmail,
      subscriptionId: params.subscriptionId,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to link subscription',
    }
  }
}

export async function getDugsiPaymentStatus(
  parentEmail: string
): Promise<ActionResult<PaymentStatusData>> {
  try {
    const result = await getPaymentStatus(parentEmail)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to get payment status', {
      parentEmail,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get payment status',
    }
  }
}

export async function verifyDugsiBankAccount(
  paymentIntentId: string,
  descriptorCode: string
): Promise<ActionResult<BankVerificationData>> {
  try {
    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
      return {
        success: false,
        error: 'Invalid payment intent ID format. Must start with "pi_"',
      }
    }

    const cleanCode = descriptorCode.trim().toUpperCase()
    if (!/^SM[A-Z0-9]{4}$/.test(cleanCode)) {
      return {
        success: false,
        error:
          'Invalid descriptor code format. Must be 6 characters starting with SM (e.g., SMT86W)',
      }
    }

    const result = await verifyBankAccount(paymentIntentId, cleanCode)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
    }
  } catch (error: unknown) {
    await logError(logger, error, 'Failed to verify bank account', {
      paymentIntentId,
    })

    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'StripeInvalidRequestError' &&
      'code' in error
    ) {
      if (error.code === 'payment_intent_unexpected_state') {
        return {
          success: false,
          error: 'This bank account has already been verified',
        }
      }
      if (error.code === 'incorrect_code') {
        return {
          success: false,
          error:
            'Incorrect verification code. Please check the code in the bank statement and try again',
        }
      }
      if (error.code === 'resource_missing') {
        return {
          success: false,
          error: 'Payment intent not found. The verification may have expired',
        }
      }
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to verify bank account',
    }
  }
}

export interface GenerateFamilyPaymentLinkInput {
  familyId: string
  overrideAmount?: number
  billingStartDate?: string
}

export interface FamilyPaymentLinkData {
  paymentUrl: string
  calculatedRate: number
  finalRate: number
  isOverride: boolean
  rateDescription: string
  tierDescription: string
  familyName: string
  childCount: number
}

export async function generateFamilyPaymentLinkAction(
  input: GenerateFamilyPaymentLinkInput
): Promise<ActionResult<FamilyPaymentLinkData>> {
  const { familyId, overrideAmount, billingStartDate } = input

  try {
    const result = await createDugsiCheckoutSession({
      familyId,
      overrideAmount,
      billingStartDate,
    })

    await logInfo(logger, 'Payment link generated', {
      familyId,
      familyName: result.familyName,
      childCount: result.childCount,
      finalRate: result.finalRate,
      isOverride: result.isOverride,
    })

    return {
      success: true,
      data: {
        paymentUrl: result.url,
        calculatedRate: result.calculatedRate,
        finalRate: result.finalRate,
        isOverride: result.isOverride,
        rateDescription: result.rateDescription,
        tierDescription: result.tierDescription,
        familyName: result.familyName,
        childCount: result.childCount,
      },
    }
  } catch (error) {
    if (error instanceof ActionError) {
      return {
        success: false,
        error: error.message,
      }
    }

    await logError(logger, error, 'Failed to generate family payment link', {
      familyId,
      overrideAmount,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate payment link',
    }
  }
}

const BulkPaymentLinksSchema = z.object({
  familyIds: z.array(z.string()).min(1, 'At least one family must be selected'),
})

export async function bulkGeneratePaymentLinksAction(params: {
  familyIds: string[]
}): Promise<
  ActionResult<{
    links: Array<{
      familyId: string
      familyName: string
      paymentUrl: string
      childCount: number
      rate: number
    }>
    failed: Array<{
      familyId: string
      familyName: string
      error: string
    }>
  }>
> {
  const validation = BulkPaymentLinksSchema.safeParse(params)
  if (!validation.success) {
    const errorMessages = validation.error.errors.map((e) => e.message)
    return {
      success: false,
      error:
        errorMessages.length > 1
          ? `Validation errors: ${errorMessages.join('; ')}`
          : errorMessages[0] || 'Invalid input',
    }
  }

  const links: Array<{
    familyId: string
    familyName: string
    paymentUrl: string
    childCount: number
    rate: number
  }> = []
  const failed: Array<{
    familyId: string
    familyName: string
    error: string
  }> = []

  const BATCH_SIZE = 5
  const familyIds = validation.data.familyIds

  for (let i = 0; i < familyIds.length; i += BATCH_SIZE) {
    const batch = familyIds.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map((familyId) => generateFamilyPaymentLinkAction({ familyId }))
    )

    for (let j = 0; j < results.length; j++) {
      const familyId = batch[j]
      const result = results[j]

      if (result.status === 'fulfilled') {
        const { value } = result
        if (value.success && value.data) {
          links.push({
            familyId,
            familyName: value.data.familyName,
            paymentUrl: value.data.paymentUrl,
            childCount: value.data.childCount,
            rate: value.data.finalRate,
          })
        } else {
          failed.push({
            familyId,
            familyName: familyId,
            error: value.error || 'Unknown error',
          })
        }
      } else {
        const error = result.reason
        await logError(
          logger,
          error,
          'Failed to generate payment link in bulk operation',
          { familyId }
        )
        failed.push({
          familyId,
          familyName: familyId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  if (links.length === 0 && failed.length > 0) {
    return {
      success: false,
      error: `Failed to generate payment links for ${failed.length} ${failed.length === 1 ? 'family' : 'families'}`,
    }
  }

  return { success: true, data: { links, failed } }
}

const PaymentHistorySchema = z.object({
  customerId: z
    .string()
    .startsWith('cus_', 'Invalid Stripe customer ID format'),
})

export async function getFamilyPaymentHistory(
  customerId: string
): Promise<ActionResult<StripePaymentHistoryItem[]>> {
  const validation = PaymentHistorySchema.safeParse({ customerId })
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid customer ID',
    }
  }

  try {
    const stripe = getDugsiStripeClient()

    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 50,
    })

    const history: StripePaymentHistoryItem[] = invoices.data
      .filter(
        (invoice): invoice is typeof invoice & { id: string } => !!invoice.id
      )
      .map((invoice) => ({
        id: invoice.id,
        date: new Date(invoice.created * 1000),
        amount: invoice.total ?? invoice.amount_paid,
        status:
          invoice.status === 'paid'
            ? 'succeeded'
            : invoice.status === 'open'
              ? 'pending'
              : 'failed',
        description:
          invoice.description ||
          `Invoice for ${invoice.lines.data[0]?.description || 'subscription'}`,
        invoiceUrl: invoice.hosted_invoice_url ?? null,
      }))

    return { success: true, data: history }
  } catch (error) {
    await logError(logger, error, 'Failed to fetch payment history', {
      customerId,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch payment history',
    }
  }
}

export async function generateDugsiVCardContent(): Promise<
  ActionResult<VCardResult>
> {
  try {
    const registrations = await getAllDugsiRegistrations()

    const familyMap = new Map<string, DugsiRegistration[]>()
    for (const reg of registrations) {
      const key =
        reg.familyReferenceId ||
        reg.parentEmail?.toLowerCase() ||
        reg.parentPhone ||
        reg.id
      const list = familyMap.get(key) ?? []
      list.push(reg)
      familyMap.set(key, list)
    }

    const families: Family[] = Array.from(familyMap.entries()).map(
      ([key, members]) => {
        const first = members[0]
        return {
          familyKey: key,
          members,
          hasPayment: members.some((m) => m.paymentMethodCaptured),
          hasSubscription: members.some(
            (m) =>
              m.stripeSubscriptionIdDugsi && m.subscriptionStatus === 'active'
          ),
          hasChurned: members.some(
            (m) =>
              m.stripeSubscriptionIdDugsi && m.subscriptionStatus === 'canceled'
          ),
          parentEmail: first.parentEmail,
          parentPhone: first.parentPhone,
        }
      }
    )

    const contacts: VCardContact[] = []
    const seen = new Set<string>()
    let skipped = 0

    for (const family of families) {
      const first = family.members[0]
      const childNames = family.members.map((m) => m.name).join(', ')

      const addParent = (
        firstName: string | null,
        lastName: string | null,
        email: string | null,
        phone: string | null
      ) => {
        const formattedPhone = formatPhoneForVCard(phone)
        if (!formattedPhone && !email) {
          skipped++
          return
        }

        const dedupeKey = email?.toLowerCase() || formattedPhone || ''
        if (seen.has(dedupeKey)) {
          skipped++
          return
        }
        seen.add(dedupeKey)

        contacts.push({
          firstName: firstName || '',
          lastName: lastName || '',
          fullName:
            [firstName, lastName].filter(Boolean).join(' ') || 'Dugsi Parent',
          phone: formattedPhone,
          email: email || undefined,
          organization: 'Irshad Dugsi',
          note: `Children: ${childNames}`,
        })
      }

      if (first.parentFirstName || first.parentLastName) {
        addParent(
          first.parentFirstName,
          first.parentLastName,
          first.parentEmail,
          first.parentPhone
        )
      }

      if (first.parent2FirstName || first.parent2LastName) {
        addParent(
          first.parent2FirstName,
          first.parent2LastName,
          first.parent2Email,
          first.parent2Phone
        )
      }
    }

    return {
      success: true,
      data: {
        content: generateVCardsContent(contacts),
        filename: `dugsi-parent-contacts-${getDateString()}.vcf`,
        exported: contacts.length,
        skipped,
      },
    }
  } catch (error) {
    await logError(logger, error, 'Failed to generate Dugsi vCard content')
    return createErrorResult(error, 'Failed to generate vCard content')
  }
}

const SendPaymentLinkViaWhatsAppSchema = z.object({
  phone: z
    .string()
    .min(10, 'Phone number too short')
    .max(15, 'Phone number too long'),
  parentName: z
    .string()
    .min(1, 'Parent name required')
    .max(100, 'Parent name too long'),
  amount: z
    .number()
    .int('Amount must be an integer')
    .positive('Amount must be positive'),
  childCount: z
    .number()
    .int('Child count must be an integer')
    .positive('Child count must be positive'),
  paymentUrl: z.string().url('Invalid payment URL'),
  familyId: z.string().optional(),
  personId: z.string().optional(),
})

export type SendPaymentLinkViaWhatsAppInput = z.infer<
  typeof SendPaymentLinkViaWhatsAppSchema
>

export interface WhatsAppSendResult {
  waMessageId?: string
}

export async function sendPaymentLinkViaWhatsAppAction(
  rawInput: unknown
): Promise<ActionResult<WhatsAppSendResult>> {
  const parseResult = SendPaymentLinkViaWhatsAppSchema.safeParse(rawInput)
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.errors[0]?.message || 'Invalid input',
    }
  }
  const input = parseResult.data

  const result = await sendPaymentLink({
    phone: input.phone,
    parentName: input.parentName,
    amount: input.amount,
    childCount: input.childCount,
    paymentUrl: input.paymentUrl,
    program: DUGSI_PROGRAM,
    personId: input.personId,
    familyId: input.familyId,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to send WhatsApp message',
    }
  }

  revalidatePath('/admin/dugsi')

  return {
    success: true,
    data: { waMessageId: result.waMessageId },
    message: 'Payment link sent via WhatsApp',
  }
}
