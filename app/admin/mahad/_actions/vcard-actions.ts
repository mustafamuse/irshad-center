'use server'

import { getBatchById } from '@/lib/db/queries/batch'
import { getStudents, getStudentsByBatch } from '@/lib/db/queries/student'
import { withActionError, ActionResult } from '@/lib/utils/action-helpers'
import {
  formatPhoneForVCard,
  generateVCardsContent,
  getDateString,
  VCardContact,
  VCardResult,
} from '@/lib/vcard-export'

export async function generateMahadVCardContent(
  batchId?: string
): Promise<ActionResult<VCardResult>> {
  return withActionError(async () => {
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
      content: generateVCardsContent(contacts),
      filename,
      exported: contacts.length,
      skipped,
    }
  }, 'Failed to generate vCard content')
}
