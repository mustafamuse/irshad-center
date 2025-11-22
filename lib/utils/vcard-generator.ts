import { BatchStudentData } from '@/lib/actions/get-batch-data'

interface VCardContact {
  fullName: string
  email?: string
  phone?: string
  hasMissingData: boolean
}

interface VCardGenerationResult {
  vcf: string
  totalContacts: number
  contactsWithMissingData: number
}

function formatPhoneNumber(phone: string | null): string | undefined {
  if (!phone) return undefined

  // Remove any non-numeric characters
  const cleaned = phone.replace(/\D/g, '')

  // Check if it's a US number (10 digits)
  if (cleaned.length === 10) {
    return `+1${cleaned}`
  }

  // If it already has a country code (11+ digits)
  if (cleaned.length >= 11) {
    return `+${cleaned}`
  }

  return `+1${cleaned}` // Default to US format
}

function createVCardString(contact: VCardContact): string {
  // iCloud prefers this specific format
  const vCardLines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'PRODID:-//Irshād Mâhad//Student Contacts//EN',
    `N:${contact.fullName};;;`, // Last;First;Middle;Prefix;Suffix
    `FN:${contact.fullName}`, // Full name as displayed
  ]

  if (contact.email) {
    vCardLines.push(`EMAIL;type=INTERNET;type=HOME:${contact.email}`)
  }

  if (contact.phone) {
    // iCloud prefers this format for phone numbers
    vCardLines.push(`TEL;type=CELL:${contact.phone}`)
  }

  // Add categories/groups for better organization in iCloud
  vCardLines.push('CATEGORIES:ROK Students')

  vCardLines.push('END:VCARD')

  return vCardLines.join('\r\n')
}

export function generateBatchVCards(
  students: BatchStudentData[],
  batchName?: string
): VCardGenerationResult {
  const contacts: VCardContact[] = students.map((student) => {
    const fullName = batchName ? `${student.name} ${batchName}` : student.name

    const phone = formatPhoneNumber(student.phone ?? null)

    const contact: VCardContact = {
      fullName,
      email: student.email || undefined,
      phone,
      hasMissingData: !student.email || !student.phone,
    }

    return contact
  })

  const vcf = contacts.map((contact) => createVCardString(contact)).join('\r\n')

  return {
    vcf,
    totalContacts: contacts.length,
    contactsWithMissingData: contacts.filter((c) => c.hasMissingData).length,
  }
}

export function getContactPreview(
  student: BatchStudentData,
  batchName?: string
): VCardContact {
  return {
    fullName: batchName ? `${student.name} ${batchName}` : student.name,
    email: student.email || undefined,
    phone: formatPhoneNumber(student.phone ?? null),
    hasMissingData: !student.email || !student.phone,
  }
}
