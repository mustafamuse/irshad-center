'use server'

import { getBatchById } from '@/lib/db/queries/batch'
import { getStudents, getStudentsByBatch } from '@/lib/db/queries/student'
import { logError } from '@/lib/logger'
import { createActionLogger } from '@/lib/logger'
import { ActionResult } from '@/lib/utils/action-helpers'
import {
  formatPhoneForVCard,
  generateVCardsContent,
  getDateString,
  VCardContact,
  VCardResult,
} from '@/lib/vcard-export'

const logger = createActionLogger('mahad-vcard')

export async function generateMahadVCardContent(
  batchId?: string
): Promise<ActionResult<VCardResult>> {
  try {
    const students = batchId
      ? await getStudentsByBatch(batchId)
      : await getStudents()

    const contacts: VCardContact[] = []
    let skipped = 0

    for (const student of students) {
      const phone = formatPhoneForVCard(student.phone)
      const email = student.email || undefined

      if (!phone && !email) {
        skipped++
        continue
      }

      const nameParts = student.name.trim().split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''
      const batchName = student.batch?.name

      contacts.push({
        firstName,
        lastName,
        fullName: student.name,
        phone,
        email,
        organization: batchName ? `Mahad - ${batchName}` : 'Mahad',
      })
    }

    let filename: string
    if (batchId) {
      const batch = await getBatchById(batchId)
      const batchName = batch?.name || 'batch'
      filename = `mahad-${batchName.toLowerCase().replace(/\s+/g, '-')}-contacts-${getDateString()}.vcf`
    } else {
      filename = `mahad-all-contacts-${getDateString()}.vcf`
    }

    return {
      success: true,
      data: {
        content: generateVCardsContent(contacts),
        filename,
        exported: contacts.length,
        skipped,
      },
    }
  } catch (error) {
    await logError(logger, error, 'Failed to generate Mahad vCard content', {
      batchId,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate vCard content',
    }
  }
}
