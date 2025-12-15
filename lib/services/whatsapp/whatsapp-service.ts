/**
 * WhatsApp Service
 *
 * Business logic for WhatsApp messaging operations.
 * Handles sending various message types and logging to database.
 */

import {
  Prisma,
  Program,
  WhatsAppMessageType,
  WhatsAppRecipientType,
} from '@prisma/client'

import {
  WHATSAPP_TEMPLATES,
  getPaymentLinkTemplate,
  getPaymentConfirmedTemplate,
  getPaymentReminderTemplate,
  getDuplicateWindowHours,
  BULK_MESSAGE_DELAY_MS,
} from '@/lib/constants/whatsapp'
import { prisma } from '@/lib/db'
import { hasRecentMessage } from '@/lib/db/queries/whatsapp'
import { createServiceLogger, logError, logWarning } from '@/lib/logger'

import {
  createWhatsAppClient,
  formatPhoneForWhatsApp,
  isValidPhoneNumber,
} from './whatsapp-client'

const logger = createServiceLogger('whatsapp-service')

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface SendMessageResult {
  success: boolean
  waMessageId?: string
  error?: string
}

interface BaseMessageInput {
  phone: string
  program: Program
  personId?: string
  familyId?: string
}

interface MessageContext {
  templateName: string
  formattedPhone: string
  messageType: WhatsAppMessageType
  recipientType: WhatsAppRecipientType
  bodyParams: string[]
  buttonParams?: string[]
  metadata: Prisma.InputJsonValue
  batchId?: string
}

// ============================================================================
// CORE MESSAGE SENDING (DRY extraction)
// ============================================================================

async function validateAndPreparePhone(
  phone: string,
  logContext: Record<string, unknown>
): Promise<
  { valid: false; error: string } | { valid: true; formattedPhone: string }
> {
  if (!isValidPhoneNumber(phone)) {
    await logWarning(logger, 'Invalid phone number for WhatsApp', logContext)
    return { valid: false, error: 'Invalid phone number format' }
  }
  return { valid: true, formattedPhone: formatPhoneForWhatsApp(phone) }
}

async function checkDuplicateMessage(
  formattedPhone: string,
  templateName: string,
  program: Program
): Promise<{ isDuplicate: boolean; error?: string }> {
  const windowHours = getDuplicateWindowHours(templateName)
  const isDuplicate = await hasRecentMessage(
    formattedPhone,
    templateName,
    windowHours
  )
  if (isDuplicate) {
    await logWarning(logger, 'Duplicate WhatsApp message blocked', {
      phone: formattedPhone,
      templateName,
      program,
      windowHours,
    })
    return {
      isDuplicate: true,
      error: `Message already sent within the last ${windowHours} hour(s)`,
    }
  }
  return { isDuplicate: false }
}

async function createMessageRecord(
  context: MessageContext,
  input: BaseMessageInput,
  waMessageId: string | undefined,
  status: 'sent' | 'failed',
  failureReason?: string
) {
  const messageData = {
    phoneNumber: context.formattedPhone,
    templateName: context.templateName,
    program: input.program,
    recipientType: context.recipientType,
    personId: input.personId,
    familyId: input.familyId,
    batchId: context.batchId,
    messageType: context.messageType,
    status,
    ...(status === 'failed' && {
      failedAt: new Date(),
      failureReason,
    }),
    metadata: context.metadata,
  }

  if (waMessageId) {
    await prisma.whatsAppMessage.upsert({
      where: { waMessageId },
      create: { waMessageId, ...messageData },
      update: {
        status,
        ...(status === 'failed' && { failedAt: new Date(), failureReason }),
      },
    })
  } else {
    await prisma.whatsAppMessage.create({
      data: { waMessageId, ...messageData },
    })
  }
}

async function sendTemplateMessage(
  context: MessageContext,
  input: BaseMessageInput,
  logMessage: string
): Promise<SendMessageResult> {
  try {
    const client = createWhatsAppClient()
    const response = await client.sendTemplate(
      context.formattedPhone,
      context.templateName,
      'en',
      context.bodyParams,
      context.buttonParams
    )

    const waMessageId = response.messages[0]?.id

    await createMessageRecord(context, input, waMessageId, 'sent')

    logger.info(
      {
        waMessageId,
        phone: context.formattedPhone,
        program: input.program,
        templateName: context.templateName,
      },
      logMessage
    )

    return { success: true, waMessageId }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    await logError(
      logger,
      error,
      `Failed to send WhatsApp ${context.templateName}`,
      {
        phone: context.formattedPhone,
        program: input.program,
      }
    )

    await createMessageRecord(context, input, undefined, 'failed', errorMessage)

    return { success: false, error: errorMessage }
  }
}

// ============================================================================
// PUBLIC API: Payment Link
// ============================================================================

export interface SendPaymentLinkInput extends BaseMessageInput {
  parentName: string
  amount: number
  childCount: number
  paymentUrl: string
}

export async function sendPaymentLink(
  input: SendPaymentLinkInput
): Promise<SendMessageResult> {
  const { phone, parentName, amount, childCount, paymentUrl, program } = input

  const phoneResult = await validateAndPreparePhone(phone, {
    phone,
    parentName,
    program,
  })
  if (!phoneResult.valid) {
    return { success: false, error: phoneResult.error }
  }
  const { formattedPhone } = phoneResult

  const templateName = getPaymentLinkTemplate(program)

  const duplicateCheck = await checkDuplicateMessage(
    formattedPhone,
    templateName,
    program
  )
  if (duplicateCheck.isDuplicate) {
    return { success: false, error: duplicateCheck.error }
  }

  const sessionIdMatch = paymentUrl.match(/cs_[a-zA-Z0-9_]+/)
  if (!sessionIdMatch) {
    await logWarning(
      logger,
      'Invalid Stripe checkout URL - no session ID found',
      {
        paymentUrl,
        phone: formattedPhone,
        program,
      }
    )
    return { success: false, error: 'Invalid payment URL format' }
  }

  const firstName = parentName.split(' ')[0] || parentName

  return sendTemplateMessage(
    {
      templateName,
      formattedPhone,
      messageType: WhatsAppMessageType.TRANSACTIONAL,
      recipientType: WhatsAppRecipientType.PARENT,
      bodyParams: [firstName, formatCurrency(amount), childCount.toString()],
      buttonParams: [sessionIdMatch[0]],
      metadata: { parentName, amount, childCount, paymentUrl },
    },
    input,
    'Payment link sent via WhatsApp'
  )
}

// ============================================================================
// PUBLIC API: Payment Confirmation
// ============================================================================

export interface SendPaymentConfirmationInput extends BaseMessageInput {
  parentName: string
  amount: number
  nextPaymentDate: Date
  studentNames: string[]
}

export async function sendPaymentConfirmation(
  input: SendPaymentConfirmationInput
): Promise<SendMessageResult> {
  const { phone, parentName, amount, nextPaymentDate, studentNames, program } =
    input

  const phoneResult = await validateAndPreparePhone(phone, {
    phone,
    parentName,
    program,
  })
  if (!phoneResult.valid) {
    return { success: false, error: phoneResult.error }
  }
  const { formattedPhone } = phoneResult

  const templateName = getPaymentConfirmedTemplate(program)

  const duplicateCheck = await checkDuplicateMessage(
    formattedPhone,
    templateName,
    program
  )
  if (duplicateCheck.isDuplicate) {
    return { success: false, error: duplicateCheck.error }
  }

  const firstName = parentName.split(' ')[0] || parentName

  return sendTemplateMessage(
    {
      templateName,
      formattedPhone,
      messageType: WhatsAppMessageType.NOTIFICATION,
      recipientType: WhatsAppRecipientType.PARENT,
      bodyParams: [
        firstName,
        formatCurrency(amount),
        formatDate(nextPaymentDate),
        studentNames.join(', '),
      ],
      metadata: {
        parentName,
        amount,
        nextPaymentDate: nextPaymentDate.toISOString(),
        studentNames,
      },
    },
    input,
    'Payment confirmation sent via WhatsApp'
  )
}

// ============================================================================
// PUBLIC API: Payment Reminder
// ============================================================================

export interface SendPaymentReminderInput extends BaseMessageInput {
  parentName: string
  amount: number
  dueDate: Date
  billingUrl: string
}

export async function sendPaymentReminder(
  input: SendPaymentReminderInput
): Promise<SendMessageResult> {
  const { phone, parentName, amount, dueDate, billingUrl, program } = input

  const phoneResult = await validateAndPreparePhone(phone, {
    phone,
    parentName,
    program,
  })
  if (!phoneResult.valid) {
    return { success: false, error: phoneResult.error }
  }
  const { formattedPhone } = phoneResult

  const templateName = getPaymentReminderTemplate(program)

  const duplicateCheck = await checkDuplicateMessage(
    formattedPhone,
    templateName,
    program
  )
  if (duplicateCheck.isDuplicate) {
    return { success: false, error: duplicateCheck.error }
  }

  const firstName = parentName.split(' ')[0] || parentName
  const urlSuffix = billingUrl.split('/').pop() || ''

  return sendTemplateMessage(
    {
      templateName,
      formattedPhone,
      messageType: WhatsAppMessageType.REMINDER,
      recipientType: WhatsAppRecipientType.PARENT,
      bodyParams: [firstName, formatCurrency(amount), formatDate(dueDate)],
      buttonParams: urlSuffix ? [urlSuffix] : undefined,
      metadata: {
        parentName,
        amount,
        dueDate: dueDate.toISOString(),
        billingUrl,
      },
    },
    input,
    'Payment reminder sent via WhatsApp'
  )
}

// ============================================================================
// PUBLIC API: Class Announcement
// ============================================================================

export interface SendClassAnnouncementInput {
  phone: string
  message: string
  program: Program
  recipientType: WhatsAppRecipientType
  personId?: string
  familyId?: string
  batchId?: string
}

export async function sendClassAnnouncement(
  input: SendClassAnnouncementInput
): Promise<SendMessageResult> {
  const {
    phone,
    message,
    program,
    recipientType,
    personId,
    familyId,
    batchId,
  } = input

  const phoneResult = await validateAndPreparePhone(phone, {
    phone,
    program,
    recipientType,
  })
  if (!phoneResult.valid) {
    return { success: false, error: phoneResult.error }
  }
  const { formattedPhone } = phoneResult

  const templateName = WHATSAPP_TEMPLATES.DUGSI_CLASS_ANNOUNCEMENT

  return sendTemplateMessage(
    {
      templateName,
      formattedPhone,
      messageType: WhatsAppMessageType.ANNOUNCEMENT,
      recipientType,
      bodyParams: [message],
      batchId,
      metadata: { message },
    },
    { phone, program, personId, familyId },
    'Class announcement sent via WhatsApp'
  )
}

// ============================================================================
// PUBLIC API: Bulk Announcement
// ============================================================================

export interface BulkSendResult {
  total: number
  sent: number
  failed: number
  results: Array<{
    phone: string
    success: boolean
    waMessageId?: string
    error?: string
  }>
}

export async function sendBulkAnnouncement(
  recipients: Array<{
    phone: string
    personId?: string
    familyId?: string
  }>,
  message: string,
  program: Program,
  recipientType: WhatsAppRecipientType,
  batchId?: string
): Promise<BulkSendResult> {
  const results: BulkSendResult['results'] = []
  let sent = 0
  let failed = 0

  for (const recipient of recipients) {
    const result = await sendClassAnnouncement({
      phone: recipient.phone,
      message,
      program,
      recipientType,
      personId: recipient.personId,
      familyId: recipient.familyId,
      batchId,
    })

    results.push({
      phone: recipient.phone,
      success: result.success,
      waMessageId: result.waMessageId,
      error: result.error,
    })

    if (result.success) {
      sent++
    } else {
      failed++
    }

    await new Promise((resolve) => setTimeout(resolve, BULK_MESSAGE_DELAY_MS))
  }

  logger.info(
    {
      total: recipients.length,
      sent,
      failed,
      program,
      recipientType,
    },
    'Bulk announcement completed'
  )

  return {
    total: recipients.length,
    sent,
    failed,
    results,
  }
}

// Re-export the result type for backwards compatibility
export type SendPaymentLinkResult = SendMessageResult
