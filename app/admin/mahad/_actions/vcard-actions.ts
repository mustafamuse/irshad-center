'use server'

import { z } from 'zod'

import { getStudents, getStudentsByBatch } from '@/lib/db/queries/student'
import { createServiceLogger } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import { StudentStatus } from '@/lib/types/student'
import {
  formatPhoneForVCard,
  generateVCardsContent,
  getDateString,
  VCardContact,
  VCardResult,
} from '@/lib/vcard-export'

const logger = createServiceLogger('mahad-admin-actions')

const _generateMahadVCardContent = adminActionClient
  .metadata({ actionName: 'generateMahadVCardContent' })
  .schema(z.object({ batchId: z.string().uuid().optional() }))
  .action(async ({ parsedInput }): Promise<VCardResult> => {
    const { batchId } = parsedInput
    const allStudents = batchId
      ? await getStudentsByBatch(batchId)
      : await getStudents()

    // getStudentsByBatch already excludes withdrawn; the all-students path
    // does not, so filter here for parity between the two exports.
    const students = allStudents.filter(
      (student) => student.status !== StudentStatus.WITHDRAWN
    )

    const contacts: VCardContact[] = []
    let skippedNoContact = 0

    for (const student of students) {
      const phone = formatPhoneForVCard(student.phone)
      const email = student.email || undefined

      if (!phone && !email) {
        skippedNoContact++
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
    if (batchId && students.length > 0) {
      const batchName = students[0]?.batch?.name || 'batch'
      filename = `mahad-${batchName.toLowerCase().replace(/\s+/g, '-')}-contacts-${getDateString()}.vcf`
    } else {
      filename = `mahad-all-contacts-${getDateString()}.vcf`
    }

    logger.info(
      {
        exported: contacts.length,
        skippedNoContact,
        batchId,
      },
      'Mahad contacts exported'
    )

    return {
      content: generateVCardsContent(contacts),
      filename,
      exported: contacts.length,
      skippedNoContact,
    }
  })

export async function generateMahadVCardContent(
  ...args: Parameters<typeof _generateMahadVCardContent>
) {
  return _generateMahadVCardContent(...args)
}
