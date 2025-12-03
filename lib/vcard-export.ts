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

export interface ExportResult {
  exported: number
  skipped: number
  downloadFailed?: boolean
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

function downloadVCardFile(content: string, filename: string): boolean {
  try {
    const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  } catch {
    return false
  }
}

function getDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function exportMahadStudentsToVCard(
  students: MahadStudent[],
  batchName?: string
): ExportResult {
  const contacts: VCardContact[] = []
  let skipped = 0

  for (const student of students) {
    if (!student.phone && !student.email) {
      skipped++
      continue
    }

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

  if (contacts.length === 0) return { exported: 0, skipped }

  const vcards = contacts.map(generateVCard).join('\r\n')
  const filename = batchName
    ? `mahad-${batchName.toLowerCase().replace(/\s+/g, '-')}-contacts-${getDateString()}.vcf`
    : `mahad-all-contacts-${getDateString()}.vcf`

  const success = downloadVCardFile(vcards, filename)
  if (!success) {
    return { exported: 0, skipped, downloadFailed: true }
  }
  return { exported: contacts.length, skipped }
}

function addParentContact(
  contacts: VCardContact[],
  seenEmails: Set<string>,
  firstName: string | null,
  lastName: string | null,
  email: string | null,
  phone: string | null,
  childrenNames: string
): boolean {
  if (!firstName && !lastName) return false

  const emailLower = email?.toLowerCase()
  if (emailLower && seenEmails.has(emailLower)) return false

  const formattedPhone = formatPhoneForVCard(phone)
  if (!emailLower && !formattedPhone) return false

  if (emailLower) seenEmails.add(emailLower)

  const parentName = `${firstName || ''} ${lastName || ''}`.trim() || 'Parent'
  const displayName = `${parentName} IrshadDugsi`

  contacts.push({
    firstName: displayName,
    lastName: '',
    fullName: displayName,
    email: emailLower || undefined,
    phone: formattedPhone,
    organization: 'Irshad Center',
    note: `Children: ${childrenNames}`,
  })

  return true
}

export function exportDugsiParentsToVCard(families: Family[]): ExportResult {
  const seenEmails = new Set<string>()
  const contacts: VCardContact[] = []
  let skipped = 0

  for (const family of families) {
    const firstMember = family.members[0]
    if (!firstMember) continue

    const childrenNames = family.members.map((m) => m.name).join(', ')

    const added1 = addParentContact(
      contacts,
      seenEmails,
      firstMember.parentFirstName,
      firstMember.parentLastName,
      firstMember.parentEmail,
      firstMember.parentPhone,
      childrenNames
    )
    if (
      !added1 &&
      (firstMember.parentFirstName || firstMember.parentLastName)
    ) {
      skipped++
    }

    const added2 = addParentContact(
      contacts,
      seenEmails,
      firstMember.parent2FirstName,
      firstMember.parent2LastName,
      firstMember.parent2Email,
      firstMember.parent2Phone,
      childrenNames
    )
    if (
      !added2 &&
      (firstMember.parent2FirstName || firstMember.parent2LastName)
    ) {
      skipped++
    }
  }

  if (contacts.length === 0) return { exported: 0, skipped }

  const vcards = contacts.map(generateVCard).join('\r\n')
  const filename = `dugsi-parent-contacts-${getDateString()}.vcf`

  const success = downloadVCardFile(vcards, filename)
  if (!success) {
    return { exported: 0, skipped, downloadFailed: true }
  }
  return { exported: contacts.length, skipped }
}
