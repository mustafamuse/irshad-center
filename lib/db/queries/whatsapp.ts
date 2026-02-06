/**
 * WhatsApp Message Query Functions
 *
 * Database queries for WhatsApp message tracking.
 */

import {
  Program,
  Prisma,
  WhatsAppMessageType,
  WhatsAppRecipientType,
} from '@prisma/client'

import { prisma } from '@/lib/db'

export type DatabaseClient = typeof prisma | Prisma.TransactionClient

export interface WhatsAppMessageFilters {
  program?: Program
  recipientType?: WhatsAppRecipientType
  messageType?: WhatsAppMessageType
  status?: string
  phoneNumber?: string
  personId?: string
  familyId?: string
  startDate?: Date
  endDate?: Date
}

/**
 * Get WhatsApp messages with filters.
 * NOTE: Includes person relation. If called in a loop, consider batch loading to avoid N+1.
 */
export async function getWhatsAppMessages(
  filters: WhatsAppMessageFilters = {},
  options: { limit?: number; offset?: number } = {},
  client: DatabaseClient = prisma
) {
  const { limit = 50, offset = 0 } = options

  const where: Prisma.WhatsAppMessageWhereInput = {}

  if (filters.program) where.program = filters.program
  if (filters.recipientType) where.recipientType = filters.recipientType
  if (filters.messageType) where.messageType = filters.messageType
  if (filters.status) where.status = filters.status
  if (filters.phoneNumber) where.phoneNumber = filters.phoneNumber
  if (filters.personId) where.personId = filters.personId
  if (filters.familyId) where.familyId = filters.familyId

  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }

  return client.whatsAppMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    relationLoadStrategy: 'join',
    include: {
      person: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })
}

export async function getWhatsAppMessageByWaId(
  waMessageId: string,
  client: DatabaseClient = prisma
) {
  return client.whatsAppMessage.findUnique({
    where: { waMessageId },
  })
}

export async function getWhatsAppMessageById(
  id: string,
  client: DatabaseClient = prisma
) {
  return client.whatsAppMessage.findUnique({
    where: { id },
    relationLoadStrategy: 'join',
    include: {
      person: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })
}

export async function getFailedMessages(
  filters: Omit<WhatsAppMessageFilters, 'status'> = {},
  options: { limit?: number; offset?: number } = {},
  client: DatabaseClient = prisma
) {
  return getWhatsAppMessages({ ...filters, status: 'failed' }, options, client)
}

export async function getMessageCountByStatus(
  filters: Omit<WhatsAppMessageFilters, 'status'> = {},
  client: DatabaseClient = prisma
) {
  const where: Prisma.WhatsAppMessageWhereInput = {}

  if (filters.program) where.program = filters.program
  if (filters.recipientType) where.recipientType = filters.recipientType
  if (filters.messageType) where.messageType = filters.messageType
  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }

  const results = await client.whatsAppMessage.groupBy({
    by: ['status'],
    where,
    _count: { status: true },
  })

  return results.reduce(
    (acc, r) => {
      acc[r.status] = r._count.status
      return acc
    },
    {} as Record<string, number>
  )
}

export async function updateMessageStatus(
  waMessageId: string,
  status: string,
  failureReason?: string,
  client: DatabaseClient = prisma
) {
  const data: Prisma.WhatsAppMessageUpdateInput = { status }

  if (status === 'failed') {
    data.failedAt = new Date()
    if (failureReason) {
      data.failureReason = failureReason
    }
  }

  return client.whatsAppMessage.update({
    where: { waMessageId },
    data,
  })
}

export async function getMessagesByFamily(
  familyId: string,
  options: { limit?: number; offset?: number } = {},
  client: DatabaseClient = prisma
) {
  return getWhatsAppMessages({ familyId }, options, client)
}

export async function getMessagesByPerson(
  personId: string,
  options: { limit?: number; offset?: number } = {},
  client: DatabaseClient = prisma
) {
  return getWhatsAppMessages({ personId }, options, client)
}

export async function getRecentMessagesToPhone(
  phoneNumber: string,
  withinHours: number = 24,
  limit: number = 100,
  client: DatabaseClient = prisma
) {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - withinHours)

  return client.whatsAppMessage.findMany({
    where: {
      phoneNumber,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function hasRecentMessage(
  phoneNumber: string,
  templateName: string,
  withinHours: number = 24,
  client: DatabaseClient = prisma
): Promise<boolean> {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - withinHours)

  const count = await client.whatsAppMessage.count({
    where: {
      phoneNumber,
      templateName,
      createdAt: { gte: cutoff },
      status: 'sent',
    },
  })

  return count > 0
}
