/**
 * WhatsApp Service
 *
 * Business logic for WhatsApp messaging operations.
 * Handles sending various message types and logging to database.
 */

import {
  Program,
  WhatsAppMessageType,
  WhatsAppRecipientType,
} from '@prisma/client'

import {
  WHATSAPP_TEMPLATES,
  getPaymentLinkTemplate,
  getPaymentConfirmedTemplate,
  getPaymentReminderTemplate,
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

export interface SendPaymentLinkInput {
  phone: string
  parentName: string
  amount: number
  childCount: number
  paymentUrl: string
  program: Program
  personId?: string
  familyId?: string
}

export interface SendPaymentLinkResult {
  success: boolean
  waMessageId?: string
  error?: string
}

export async function sendPaymentLink(
  input: SendPaymentLinkInput
): Promise<SendPaymentLinkResult> {
  const {
    phone,
    parentName,
    amount,
    childCount,
    paymentUrl,
    program,
    personId,
    familyId,
  } = input

  if (!isValidPhoneNumber(phone)) {
    await logWarning(logger, 'Invalid phone number for WhatsApp', {
      phone,
      parentName,
      program,
    })
    return { success: false, error: 'Invalid phone number format' }
  }

  const templateName = getPaymentLinkTemplate(program)
  const formattedPhone = formatPhoneForWhatsApp(phone)

  const isDuplicate = await hasRecentMessage(formattedPhone, templateName, 1)
  if (isDuplicate) {
    await logWarning(logger, 'Duplicate WhatsApp message blocked', {
      phone: formattedPhone,
      templateName,
      program,
    })
    return {
      success: false,
      error: 'Message already sent within the last hour',
    }
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
  const buttonParams = [sessionIdMatch[0]]

  const formattedAmount = formatCurrency(amount)
  const firstName = parentName.split(' ')[0] || parentName
  const bodyParams = [firstName, formattedAmount, childCount.toString()]

  try {
    const client = createWhatsAppClient()
    const response = await client.sendTemplate(
      formattedPhone,
      templateName,
      'en',
      bodyParams,
      buttonParams
    )

    const waMessageId = response.messages[0]?.id

    await prisma.whatsAppMessage.create({
      data: {
        waMessageId,
        phoneNumber: formattedPhone,
        templateName,
        program,
        recipientType: WhatsAppRecipientType.PARENT,
        personId,
        familyId,
        messageType: WhatsAppMessageType.TRANSACTIONAL,
        status: 'sent',
        metadata: {
          parentName,
          amount,
          childCount,
          paymentUrl,
        },
      },
    })

    logger.info(
      {
        waMessageId,
        phone: formattedPhone,
        parentName,
        program,
        templateName,
      },
      'Payment link sent via WhatsApp'
    )

    return { success: true, waMessageId }
  } catch (error) {
    await logError(logger, error, 'Failed to send WhatsApp payment link', {
      phone: formattedPhone,
      parentName,
      program,
    })

    await prisma.whatsAppMessage.create({
      data: {
        phoneNumber: formattedPhone,
        templateName,
        program,
        recipientType: WhatsAppRecipientType.PARENT,
        personId,
        familyId,
        messageType: WhatsAppMessageType.TRANSACTIONAL,
        status: 'failed',
        failedAt: new Date(),
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          parentName,
          amount,
          childCount,
          paymentUrl,
        },
      },
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    }
  }
}

export interface SendPaymentConfirmationInput {
  phone: string
  parentName: string
  amount: number
  nextPaymentDate: Date
  studentNames: string[]
  program: Program
  personId?: string
  familyId?: string
}

export async function sendPaymentConfirmation(
  input: SendPaymentConfirmationInput
): Promise<SendPaymentLinkResult> {
  const {
    phone,
    parentName,
    amount,
    nextPaymentDate,
    studentNames,
    program,
    personId,
    familyId,
  } = input

  if (!isValidPhoneNumber(phone)) {
    return { success: false, error: 'Invalid phone number format' }
  }

  const templateName = getPaymentConfirmedTemplate(program)
  const formattedPhone = formatPhoneForWhatsApp(phone)

  const isDuplicate = await hasRecentMessage(formattedPhone, templateName, 1)
  if (isDuplicate) {
    await logWarning(logger, 'Duplicate WhatsApp message blocked', {
      phone: formattedPhone,
      templateName,
      program,
    })
    return {
      success: false,
      error: 'Message already sent within the last hour',
    }
  }

  const formattedAmount = formatCurrency(amount)
  const formattedDate = formatDate(nextPaymentDate)

  const firstName = parentName.split(' ')[0] || parentName
  const bodyParams = [
    firstName,
    formattedAmount,
    formattedDate,
    studentNames.join(', '),
  ]

  try {
    const client = createWhatsAppClient()
    const response = await client.sendTemplate(
      formattedPhone,
      templateName,
      'en',
      bodyParams
    )

    const waMessageId = response.messages[0]?.id

    await prisma.whatsAppMessage.create({
      data: {
        waMessageId,
        phoneNumber: formattedPhone,
        templateName,
        program,
        recipientType: WhatsAppRecipientType.PARENT,
        personId,
        familyId,
        messageType: WhatsAppMessageType.NOTIFICATION,
        status: 'sent',
        metadata: {
          parentName,
          amount,
          nextPaymentDate: nextPaymentDate.toISOString(),
          studentNames,
        },
      },
    })

    logger.info(
      {
        waMessageId,
        phone: formattedPhone,
        parentName,
        program,
        templateName,
      },
      'Payment confirmation sent via WhatsApp'
    )

    return { success: true, waMessageId }
  } catch (error) {
    await logError(
      logger,
      error,
      'Failed to send WhatsApp payment confirmation',
      {
        phone: formattedPhone,
        parentName,
        program,
      }
    )

    await prisma.whatsAppMessage.create({
      data: {
        phoneNumber: formattedPhone,
        templateName,
        program,
        recipientType: WhatsAppRecipientType.PARENT,
        personId,
        familyId,
        messageType: WhatsAppMessageType.NOTIFICATION,
        status: 'failed',
        failedAt: new Date(),
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          parentName,
          amount,
          nextPaymentDate: nextPaymentDate.toISOString(),
          studentNames,
        },
      },
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    }
  }
}

export interface SendPaymentReminderInput {
  phone: string
  parentName: string
  amount: number
  dueDate: Date
  billingUrl: string
  program: Program
  personId?: string
  familyId?: string
}

export async function sendPaymentReminder(
  input: SendPaymentReminderInput
): Promise<SendPaymentLinkResult> {
  const {
    phone,
    parentName,
    amount,
    dueDate,
    billingUrl,
    program,
    personId,
    familyId,
  } = input

  if (!isValidPhoneNumber(phone)) {
    return { success: false, error: 'Invalid phone number format' }
  }

  const templateName = getPaymentReminderTemplate(program)
  const formattedPhone = formatPhoneForWhatsApp(phone)

  const isDuplicate = await hasRecentMessage(formattedPhone, templateName, 1)
  if (isDuplicate) {
    await logWarning(logger, 'Duplicate WhatsApp message blocked', {
      phone: formattedPhone,
      templateName,
      program,
    })
    return {
      success: false,
      error: 'Message already sent within the last hour',
    }
  }

  const formattedAmount = formatCurrency(amount)
  const formattedDate = formatDate(dueDate)

  const firstName = parentName.split(' ')[0] || parentName
  const bodyParams = [firstName, formattedAmount, formattedDate]

  const urlSuffix = billingUrl.split('/').pop() || ''
  const buttonParams = urlSuffix ? [urlSuffix] : undefined

  try {
    const client = createWhatsAppClient()
    const response = await client.sendTemplate(
      formattedPhone,
      templateName,
      'en',
      bodyParams,
      buttonParams
    )

    const waMessageId = response.messages[0]?.id

    await prisma.whatsAppMessage.create({
      data: {
        waMessageId,
        phoneNumber: formattedPhone,
        templateName,
        program,
        recipientType: WhatsAppRecipientType.PARENT,
        personId,
        familyId,
        messageType: WhatsAppMessageType.REMINDER,
        status: 'sent',
        metadata: {
          parentName,
          amount,
          dueDate: dueDate.toISOString(),
          billingUrl,
        },
      },
    })

    logger.info(
      {
        waMessageId,
        phone: formattedPhone,
        parentName,
        program,
        templateName,
      },
      'Payment reminder sent via WhatsApp'
    )

    return { success: true, waMessageId }
  } catch (error) {
    await logError(logger, error, 'Failed to send WhatsApp payment reminder', {
      phone: formattedPhone,
      parentName,
      program,
    })

    await prisma.whatsAppMessage.create({
      data: {
        phoneNumber: formattedPhone,
        templateName,
        program,
        recipientType: WhatsAppRecipientType.PARENT,
        personId,
        familyId,
        messageType: WhatsAppMessageType.REMINDER,
        status: 'failed',
        failedAt: new Date(),
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          parentName,
          amount,
          dueDate: dueDate.toISOString(),
          billingUrl,
        },
      },
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    }
  }
}

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
): Promise<SendPaymentLinkResult> {
  const {
    phone,
    message,
    program,
    recipientType,
    personId,
    familyId,
    batchId,
  } = input

  if (!isValidPhoneNumber(phone)) {
    return { success: false, error: 'Invalid phone number format' }
  }

  const templateName = WHATSAPP_TEMPLATES.DUGSI_CLASS_ANNOUNCEMENT
  const formattedPhone = formatPhoneForWhatsApp(phone)
  const bodyParams = [message]

  try {
    const client = createWhatsAppClient()
    const response = await client.sendTemplate(
      formattedPhone,
      templateName,
      'en',
      bodyParams
    )

    const waMessageId = response.messages[0]?.id

    await prisma.whatsAppMessage.create({
      data: {
        waMessageId,
        phoneNumber: formattedPhone,
        templateName,
        program,
        recipientType,
        personId,
        familyId,
        batchId,
        messageType: WhatsAppMessageType.ANNOUNCEMENT,
        status: 'sent',
        metadata: {
          message,
        },
      },
    })

    logger.info(
      {
        waMessageId,
        phone: formattedPhone,
        program,
        recipientType,
        templateName,
      },
      'Class announcement sent via WhatsApp'
    )

    return { success: true, waMessageId }
  } catch (error) {
    await logError(
      logger,
      error,
      'Failed to send WhatsApp class announcement',
      {
        phone: formattedPhone,
        program,
        recipientType,
      }
    )

    await prisma.whatsAppMessage.create({
      data: {
        phoneNumber: formattedPhone,
        templateName,
        program,
        recipientType,
        personId,
        familyId,
        batchId,
        messageType: WhatsAppMessageType.ANNOUNCEMENT,
        status: 'failed',
        failedAt: new Date(),
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          message,
        },
      },
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    }
  }
}

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

    await new Promise((resolve) => setTimeout(resolve, 100))
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
