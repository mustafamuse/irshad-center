'use client'

import type { Family } from '@/app/admin/dugsi/_types'
import type { MahadStudent } from '@/app/admin/mahad/_types'

interface VCardContact {
  firstName: string
  lastName: string
  fullName: string
  email?: string
  phone?: string
  organization?: string
  note?: string
}

export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function formatPhoneForVCard(
  phone: string | null | undefined
): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  return `+${digits}`
}

export function generateVCard(contact: VCardContact): string {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVCardValue(contact.lastName)};${escapeVCardValue(contact.firstName)};;;`,
    `FN:${escapeVCardValue(contact.fullName)}`,
  ]

  if (contact.phone) {
    lines.push(`TEL;TYPE=CELL:${contact.phone}`)
  }

  if (contact.email) {
    lines.push(`EMAIL:${escapeVCardValue(contact.email)}`)
  }

  if (contact.organization) {
    lines.push(`ORG:${escapeVCardValue(contact.organization)}`)
  }

  if (contact.note) {
    lines.push(`NOTE:${escapeVCardValue(contact.note)}`)
  }

  lines.push('END:VCARD')

  return lines.join('\r\n')
}

function downloadVCardFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function exportMahadStudentsToVCard(
  students: MahadStudent[],
  batchName?: string
): number {
  const contacts: VCardContact[] = []

  for (const student of students) {
    if (!student.phone && !student.email) continue

    const batchSuffix = student.batch?.name || batchName || ''
    const displayName = batchSuffix
      ? `${student.name} ${batchSuffix}`
      : student.name

    contacts.push({
      firstName: displayName,
      lastName: '',
      fullName: displayName,
      email: student.email || undefined,
      phone: formatPhoneForVCard(student.phone),
      organization: 'Irshad Center',
      note: undefined,
    })
  }

  if (contacts.length === 0) return 0

  const vcards = contacts.map(generateVCard).join('\r\n')
  const filename = batchName
    ? `mahad-${batchName.toLowerCase().replace(/\s+/g, '-')}-contacts-${getDateString()}.vcf`
    : `mahad-all-contacts-${getDateString()}.vcf`

  downloadVCardFile(vcards, filename)
  return contacts.length
}

export function exportDugsiParentsToVCard(families: Family[]): number {
  const seenEmails = new Set<string>()
  const contacts: VCardContact[] = []

  for (const family of families) {
    const firstMember = family.members[0]
    if (!firstMember) continue

    const childrenNames = family.members.map((m) => m.name).join(', ')

    if (firstMember.parentFirstName || firstMember.parentLastName) {
      const email = firstMember.parentEmail?.toLowerCase()
      if (!email || !seenEmails.has(email)) {
        if (email) seenEmails.add(email)

        const parentName =
          `${firstMember.parentFirstName || ''} ${firstMember.parentLastName || ''}`.trim() ||
          'Parent'
        const displayName = `${parentName} IrshadDugsi`

        contacts.push({
          firstName: displayName,
          lastName: '',
          fullName: displayName,
          email: email || undefined,
          phone: formatPhoneForVCard(firstMember.parentPhone),
          organization: 'Irshad Center',
          note: `Children: ${childrenNames}`,
        })
      }
    }

    if (firstMember.parent2FirstName || firstMember.parent2LastName) {
      const email2 = firstMember.parent2Email?.toLowerCase()
      if (!email2 || !seenEmails.has(email2)) {
        if (email2) seenEmails.add(email2)

        const parentName =
          `${firstMember.parent2FirstName || ''} ${firstMember.parent2LastName || ''}`.trim() ||
          'Parent'
        const displayName = `${parentName} IrshadDugsi`

        contacts.push({
          firstName: displayName,
          lastName: '',
          fullName: displayName,
          email: email2 || undefined,
          phone: formatPhoneForVCard(firstMember.parent2Phone),
          organization: 'Irshad Center',
          note: `Children: ${childrenNames}`,
        })
      }
    }
  }

  if (contacts.length === 0) return 0

  const vcards = contacts.map(generateVCard).join('\r\n')
  const filename = `dugsi-parent-contacts-${getDateString()}.vcf`

  downloadVCardFile(vcards, filename)
  return contacts.length
}
