'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import { z } from 'zod'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError, logInfo } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import {
  verifyBankAccount,
  getPaymentStatus,
  createDugsiCheckoutSession,
} from '@/lib/services/dugsi'
import { sendPaymentLink } from '@/lib/services/whatsapp/whatsapp-service'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'

import {
  PaymentStatusData,
  BankVerificationData,
  StripePaymentHistoryItem,
} from '../_types'

const logger = createServiceLogger('dugsi-admin-actions')

const ParentEmailSchema = z.object({ parentEmail: z.string().email() })

const VerifyBankSchema = z.object({
  paymentIntentId: z.string().min(1),
  descriptorCode: z.string().min(1),
})

const GenerateFamilyPaymentLinkSchema = z.object({
  familyId: z.string().min(1),
  overrideAmount: z.number().optional(),
  billingStartDate: z.string().optional(),
})

const BulkPaymentLinksSchema = z.object({
  familyIds: z
    .array(z.string())
    .min(1, 'At least one family must be selected')
    .transform((ids) => [...new Set(ids)]),
})

const PaymentHistorySchema = z.object({
  customerId: z
    .string()
    .startsWith('cus_', 'Invalid Stripe customer ID format'),
})

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

export interface WhatsAppSendResult {
  waMessageId?: string
}

const _getDugsiPaymentStatus = adminActionClient
  .metadata({ actionName: 'getDugsiPaymentStatus' })
  .schema(ParentEmailSchema)
  .action(async ({ parsedInput }): Promise<PaymentStatusData> => {
    return await getPaymentStatus(parsedInput.parentEmail)
  })

const _getFamilyPaymentHistory = adminActionClient
  .metadata({ actionName: 'getFamilyPaymentHistory' })
  .schema(PaymentHistorySchema)
  .action(async ({ parsedInput }): Promise<StripePaymentHistoryItem[]> => {
    const stripe = getDugsiStripeClient()
    const invoices = await stripe.invoices.list({
      customer: parsedInput.customerId,
      limit: 50,
    })

    return invoices.data
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
  })

const _verifyDugsiBankAccount = adminActionClient
  .metadata({ actionName: 'verifyDugsiBankAccount' })
  .schema(VerifyBankSchema)
  .action(async ({ parsedInput }): Promise<BankVerificationData> => {
    const { paymentIntentId, descriptorCode } = parsedInput

    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
      throw new ActionError(
        'Invalid payment intent ID format. Must start with "pi_"',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    const cleanCode = descriptorCode.trim().toUpperCase()
    if (!/^SM[A-Z0-9]{4}$/.test(cleanCode)) {
      throw new ActionError(
        'Invalid descriptor code format. Must be 6 characters starting with SM (e.g., SMT86W)',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    try {
      const result = await verifyBankAccount(paymentIntentId, cleanCode)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return result
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'type' in error &&
        error.type === 'StripeInvalidRequestError' &&
        'code' in error
      ) {
        if (error.code === 'payment_intent_unexpected_state') {
          throw new ActionError(
            'This bank account has already been verified',
            ERROR_CODES.STRIPE_ERROR
          )
        }
        if (error.code === 'incorrect_code') {
          throw new ActionError(
            'Incorrect verification code. Please check the code in the bank statement and try again',
            ERROR_CODES.STRIPE_ERROR
          )
        }
        if (error.code === 'resource_missing') {
          throw new ActionError(
            'Payment intent not found. The verification may have expired',
            ERROR_CODES.NOT_FOUND
          )
        }
      }
      throw error
    }
  })

const _generateFamilyPaymentLinkAction = adminActionClient
  .metadata({ actionName: 'generateFamilyPaymentLinkAction' })
  .schema(GenerateFamilyPaymentLinkSchema)
  .action(async ({ parsedInput }): Promise<FamilyPaymentLinkData> => {
    const { familyId, overrideAmount, billingStartDate } = parsedInput
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
      paymentUrl: result.url,
      calculatedRate: result.calculatedRate,
      finalRate: result.finalRate,
      isOverride: result.isOverride,
      rateDescription: result.rateDescription,
      tierDescription: result.tierDescription,
      familyName: result.familyName,
      childCount: result.childCount,
    }
  })

const _bulkGeneratePaymentLinksAction = adminActionClient
  .metadata({ actionName: 'bulkGeneratePaymentLinksAction' })
  .schema(BulkPaymentLinksSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{
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
    }> => {
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
      const familyIds = parsedInput.familyIds

      for (let i = 0; i < familyIds.length; i += BATCH_SIZE) {
        const batch = familyIds.slice(i, i + BATCH_SIZE)

        const results = await Promise.allSettled(
          batch.map((familyId) => createDugsiCheckoutSession({ familyId }))
        )

        for (let j = 0; j < results.length; j++) {
          const familyId = batch[j]
          const result = results[j]

          if (result.status === 'fulfilled') {
            const value = result.value
            links.push({
              familyId,
              familyName: value.familyName,
              paymentUrl: value.url,
              childCount: value.childCount,
              rate: value.finalRate,
            })
          } else {
            const error = result.reason
            await logError(
              logger,
              error,
              'Failed to generate payment link in bulk',
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
        throw new ActionError(
          `Failed to generate payment links for ${failed.length} ${failed.length === 1 ? 'family' : 'families'}`,
          ERROR_CODES.STRIPE_ERROR
        )
      }

      return { links, failed }
    }
  )

const _sendPaymentLinkViaWhatsAppAction = adminActionClient
  .metadata({ actionName: 'sendPaymentLinkViaWhatsAppAction' })
  .schema(SendPaymentLinkViaWhatsAppSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<WhatsAppSendResult & { message: string }> => {
      const result = await sendPaymentLink({
        phone: parsedInput.phone,
        parentName: parsedInput.parentName,
        amount: parsedInput.amount,
        childCount: parsedInput.childCount,
        paymentUrl: parsedInput.paymentUrl,
        program: DUGSI_PROGRAM,
        personId: parsedInput.personId,
        familyId: parsedInput.familyId,
      })

      if (!result.success) {
        throw new ActionError(
          result.error || 'Failed to send WhatsApp message',
          ERROR_CODES.SERVER_ERROR
        )
      }

      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return {
        waMessageId: result.waMessageId,
        message: 'Payment link sent via WhatsApp',
      }
    }
  )

export async function getDugsiPaymentStatus(
  ...args: Parameters<typeof _getDugsiPaymentStatus>
) {
  return _getDugsiPaymentStatus(...args)
}
export async function getFamilyPaymentHistory(
  ...args: Parameters<typeof _getFamilyPaymentHistory>
) {
  return _getFamilyPaymentHistory(...args)
}
export async function verifyDugsiBankAccount(
  ...args: Parameters<typeof _verifyDugsiBankAccount>
) {
  return _verifyDugsiBankAccount(...args)
}
export async function generateFamilyPaymentLinkAction(
  ...args: Parameters<typeof _generateFamilyPaymentLinkAction>
) {
  return _generateFamilyPaymentLinkAction(...args)
}
export async function bulkGeneratePaymentLinksAction(
  ...args: Parameters<typeof _bulkGeneratePaymentLinksAction>
) {
  return _bulkGeneratePaymentLinksAction(...args)
}
export async function sendPaymentLinkViaWhatsAppAction(
  ...args: Parameters<typeof _sendPaymentLinkViaWhatsAppAction>
) {
  return _sendPaymentLinkViaWhatsAppAction(...args)
}
