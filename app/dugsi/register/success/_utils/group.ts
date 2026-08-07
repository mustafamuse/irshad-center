import 'server-only'

import { createServiceLogger } from '@/lib/logger'
import type { getCachedDugsiRegistrations } from '@/lib/services/dugsi'
import { formatGradeLevel } from '@/lib/utils/enum-formatters'

import { maskEmail, maskPhone } from './mask'
import type { Family } from '../_types'

const logger = createServiceLogger('dugsi-success')

// Age is computed server-side so the raw date of birth never reaches the
// unauthenticated client payload.
export function ageInYears(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null
  const birthDate =
    dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth)
  if (isNaN(birthDate.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }
  return age
}

export function groupByFamily(
  registrations: Awaited<ReturnType<typeof getCachedDugsiRegistrations>>
): Family[] {
  const familyMap = new Map<string, Family>()
  // Legacy/imported families have no familyReferenceId and were
  // historically grouped (and keyed) by raw parent email. The key ships to
  // the client, so those groups get a synthetic opaque key instead:
  // grouping still happens on the email server-side (map key, never
  // serialized), but the client sees only `l:<n>`. A hash of the email is
  // NOT safe here — emails are guessable, so even truncated SHA-256 is an
  // offline confirmation oracle. No cross-request stability is needed:
  // highlight always matches on a real familyReferenceId.
  let legacyCounter = 0

  for (const reg of registrations) {
    // Use familyReferenceId as primary key for proper family grouping.
    // Fallback to parentEmail or id only if familyReferenceId is missing
    const groupingKey = reg.familyReferenceId || reg.parentEmail || reg.id

    if (!familyMap.has(groupingKey)) {
      familyMap.set(groupingKey, {
        familyKey: reg.familyReferenceId || `l:${legacyCounter++}`,
        parent1Name:
          reg.parentFirstName && reg.parentLastName
            ? `${reg.parentFirstName} ${reg.parentLastName}`
            : null,
        parent1MaskedEmail: maskEmail(reg.parentEmail),
        parent1MaskedPhone: maskPhone(reg.parentPhone),
        parent2Name:
          reg.parent2FirstName && reg.parent2LastName
            ? `${reg.parent2FirstName} ${reg.parent2LastName}`
            : null,
        parent2MaskedEmail: maskEmail(reg.parent2Email),
        parent2MaskedPhone: maskPhone(reg.parent2Phone),
        children: [],
        registeredAt: reg.createdAt,
      })
    } else {
      // Update parent 2 info if it exists and wasn't set before
      const family = familyMap.get(groupingKey)
      if (!family) {
        logger.error(
          { groupingKeyPresent: !!groupingKey },
          'Family not found in map during parent2 update'
        )
        continue
      }
      if (!family.parent2Name && reg.parent2FirstName && reg.parent2LastName) {
        family.parent2Name = `${reg.parent2FirstName} ${reg.parent2LastName}`
        family.parent2MaskedEmail = maskEmail(reg.parent2Email)
        family.parent2MaskedPhone = maskPhone(reg.parent2Phone)
      }
    }

    const family = familyMap.get(groupingKey)
    if (!family) {
      logger.error(
        { groupingKeyPresent: !!groupingKey },
        'Family not found in map during child push'
      )
      continue
    }
    family.children.push({
      id: reg.id,
      name: reg.name,
      gradeLevel: reg.gradeLevel ? formatGradeLevel(reg.gradeLevel) : null,
      schoolName: reg.schoolName,
      ageYears: ageInYears(reg.dateOfBirth),
      gender: reg.gender,
      createdAt: reg.createdAt,
    })

    if (reg.createdAt > family.registeredAt) {
      family.registeredAt = reg.createdAt
    }
  }

  return Array.from(familyMap.values()).sort(
    (a, b) => b.registeredAt.getTime() - a.registeredAt.getTime()
  )
}
