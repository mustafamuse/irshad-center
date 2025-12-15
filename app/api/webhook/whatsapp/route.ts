/**
 * WhatsApp Webhook Handler
 *
 * Handles:
 * - GET: Meta webhook verification challenge
 * - POST: Message status updates (sent, delivered, read, failed)
 */

import { NextRequest, NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  updateMessageStatus,
  getWhatsAppMessageByWaId,
} from '@/lib/db/queries/whatsapp'
import { createServiceLogger, logError, logWarning } from '@/lib/logger'
import {
  verifyWebhookSignature,
  WhatsAppWebhookPayload,
  WhatsAppStatus,
} from '@/lib/services/whatsapp/whatsapp-client'

const logger = createServiceLogger('whatsapp-webhook')

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (!verifyToken) {
    await logError(
      logger,
      new Error('WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured'),
      'WhatsApp webhook verify token missing'
    )
    return new NextResponse('Server configuration error', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('WhatsApp webhook verified successfully')
    return new NextResponse(challenge, { status: 200 })
  }

  await logWarning(logger, 'WhatsApp webhook verification failed', {
    mode,
    tokenProvided: !!token,
  })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET

  if (!appSecret) {
    await logError(
      logger,
      new Error('WHATSAPP_APP_SECRET not configured'),
      'WhatsApp app secret missing'
    )
    return new NextResponse('Server configuration error', { status: 500 })
  }

  const signature = request.headers.get('x-hub-signature-256')
  const rawBody = await request.text()

  if (!signature) {
    await logWarning(logger, 'WhatsApp webhook missing signature header')
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    await logWarning(logger, 'WhatsApp webhook invalid signature', {
      signatureProvided: !!signature,
    })
    return new NextResponse('Forbidden', { status: 403 })
  }

  let payload: WhatsAppWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    await logWarning(logger, 'WhatsApp webhook invalid JSON payload')
    return new NextResponse('Bad Request', { status: 400 })
  }

  if (payload.object !== 'whatsapp_business_account') {
    return new NextResponse('OK', { status: 200 })
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue

      const statuses = change.value.statuses || []
      for (const status of statuses) {
        try {
          await processStatusUpdate(status)
        } catch (error) {
          await logError(logger, error, 'Failed to process status update', {
            waMessageId: status.id,
            status: status.status,
          })
        }
      }
    }
  }

  return new NextResponse('OK', { status: 200 })
}

async function processStatusUpdate(status: WhatsAppStatus): Promise<void> {
  const { id: waMessageId, status: messageStatus, timestamp, errors } = status
  const eventId = `wa_status_${waMessageId}_${messageStatus}_${timestamp}`

  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { eventId_source: { eventId, source: 'whatsapp' } },
  })
  if (existingEvent) {
    logger.debug({ eventId }, 'Duplicate webhook event, skipping')
    return
  }

  await prisma.webhookEvent.create({
    data: {
      eventId,
      eventType: `whatsapp.message.${messageStatus}`,
      source: 'whatsapp',
      payload: status as unknown as Prisma.JsonObject,
    },
  })

  const existingMessage = await getWhatsAppMessageByWaId(waMessageId)
  if (!existingMessage) {
    logger.debug(
      { waMessageId, status: messageStatus },
      'Received status for unknown message ID'
    )
    return
  }

  let failureReason: string | undefined
  if (messageStatus === 'failed' && errors && errors.length > 0) {
    failureReason = errors.map((e) => `${e.code}: ${e.title}`).join('; ')
  }

  try {
    await updateMessageStatus(waMessageId, messageStatus, failureReason)
  } catch (error) {
    await prisma.webhookEvent.delete({
      where: { eventId_source: { eventId, source: 'whatsapp' } },
    })
    throw error
  }

  logger.info(
    {
      waMessageId,
      status: messageStatus,
      timestamp,
      ...(failureReason && { failureReason }),
    },
    'WhatsApp message status updated'
  )
}
