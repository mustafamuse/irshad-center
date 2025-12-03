export interface VCardContact {
  firstName: string
  lastName: string
  fullName: string
  email?: string
  phone?: string
  organization?: string
  note?: string
}

export interface VCardResult {
  content: string
  filename: string
  exported: number
  skipped: number
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
  if (digits.length === 0) return undefined
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`
  }
  return undefined
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

export function getDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function generateVCardsContent(contacts: VCardContact[]): string {
  return contacts.map(generateVCard).join('\r\n')
}
