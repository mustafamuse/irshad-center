'use server'

import { Shift, SubscriptionStatus } from '@prisma/client'
import { z } from 'zod'

import { createServiceLogger } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import { getAllDugsiRegistrations } from '@/lib/services/dugsi'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'
import { formatFullName } from '@/lib/utils/formatters'
import {
  formatPhoneForVCard,
  generateVCardsContent,
  getDateString,
  VCardContact,
  VCardResult,
} from '@/lib/vcard-export'

import { DugsiRegistration } from '../_types'
import {
  isActiveDugsiEnrollment,
  isActiveDugsiRegistration,
  isChurnedDugsiRegistration,
} from '../_utils/family'

const logger = createServiceLogger('dugsi-admin-actions')

// module-private
const fillVCardName = (
  target: VCardContact,
  firstName: string | null,
  lastName: string | null,
  fullName: string
) => {
  if (!target.firstName && firstName) {
    target.firstName = firstName
    target.lastName = lastName ?? ''
    target.fullName = fullName
  }
}

const ShiftFilterSchema = z.object({
  shift: z.nativeEnum(Shift).optional(),
})

const _getDugsiRegistrations = adminActionClient
  .metadata({ actionName: 'getDugsiRegistrations' })
  .schema(ShiftFilterSchema)
  .action(async ({ parsedInput }): Promise<DugsiRegistration[]> => {
    return await getAllDugsiRegistrations(undefined, parsedInput)
  })

const _generateDugsiVCardContent = adminActionClient
  .metadata({ actionName: 'generateDugsiVCardContent' })
  .schema(
    z.object({
      shift: z.nativeEnum(Shift).optional(),
      includeChurned: z.boolean().default(false),
    })
  )
  .action(
    async ({
      parsedInput: { shift, includeChurned },
    }): Promise<VCardResult> => {
      const registrations = await getAllDugsiRegistrations(
        undefined,
        shift ? { shift } : undefined
      )

      const familyMap = new Map<string, DugsiRegistration[]>()
      for (const reg of registrations) {
        const key =
          reg.familyReferenceId ||
          normalizeEmail(reg.parentEmail) ||
          normalizePhone(reg.parentPhone) ||
          reg.id
        const list = familyMap.get(key) ?? []
        list.push(reg)
        familyMap.set(key, list)
      }

      const organization = shift ? `Dugsi - ${shift}` : 'Irshad Dugsi'
      const filename = shift
        ? `dugsi-${shift.toLowerCase()}-parent-contacts-${getDateString()}.vcf`
        : `dugsi-parent-contacts-${getDateString()}.vcf`

      // contactMap and childNamesByKey are always maintained with identical key sets.
      // Every add/delete must touch both; see mergeSecondary for the delete path.
      const contactMap = new Map<string, VCardContact>()
      const childNamesByKey = new Map<string, Set<string>>()
      const phoneToKey = new Map<string, string>()
      const emailToKey = new Map<string, string>()
      let skippedNoContact = 0
      let skippedDuplicate = 0
      let skippedChurned = 0
      let skippedWithdrawn = 0

      for (const allMembers of familyMap.values()) {
        // Withdrawn children are not exported: a fully-withdrawn family is
        // skipped, a partially-withdrawn one exports only active children.
        // Subscription flags still consider all members (billing is
        // family-level and may live on a withdrawn child's record).
        const members = allMembers.filter(isActiveDugsiEnrollment)
        if (members.length === 0) {
          skippedWithdrawn++
          continue
        }
        const hasSubscription = allMembers.some(isActiveDugsiRegistration)
        const hasChurned = allMembers.some(isChurnedDugsiRegistration)
        const hasRecoverable = allMembers.some(
          (m) =>
            !!m.stripeSubscriptionIdDugsi &&
            (m.subscriptionStatus === SubscriptionStatus.past_due ||
              m.subscriptionStatus === SubscriptionStatus.unpaid)
        )
        if (
          !includeChurned &&
          hasChurned &&
          !hasSubscription &&
          !hasRecoverable
        ) {
          skippedChurned++
          continue
        }

        const first = members[0]
        if (!first) continue
        const memberNames = members.map((m) => m.name)

        const addParent = (
          firstName: string | null,
          lastName: string | null,
          email: string | null,
          phone: string | null,
          isIntraFamilyDuplicate: boolean
        ) => {
          const formattedPhone = formatPhoneForVCard(phone)
          const normalizedEmail = normalizeEmail(email)
          if (!formattedPhone && !normalizedEmail) {
            skippedNoContact++
            return
          }

          const dedupeKey = normalizedEmail || formattedPhone || ''
          // Step 1: fast path — dedupeKey is still the live contactMap key.
          // Step 2: phone bridge — dedupeKey differs but same phone seen before.
          // Step 3: email bridge — email was a live key that mergeSecondary deleted
          //   from contactMap (bridge merge); emailToKey still points to the survivor.
          //   Removing step 3 breaks A→C→B arrival order: after C's key is deleted,
          //   a later email-only record falls through steps 1 & 2 and creates a duplicate.
          const resolvedKey = contactMap.has(dedupeKey)
            ? dedupeKey
            : formattedPhone && phoneToKey.has(formattedPhone)
              ? phoneToKey.get(formattedPhone)!
              : normalizedEmail && emailToKey.has(normalizedEmail)
                ? emailToKey.get(normalizedEmail)!
                : dedupeKey

          if (contactMap.has(resolvedKey)) {
            skippedDuplicate++
            if (!isIntraFamilyDuplicate) {
              const childSet = childNamesByKey.get(resolvedKey)!
              memberNames.forEach((n) => childSet.add(n))
            }

            // Bridge detection: if the current record carries both identifiers
            // and one of them already points to a separate contact (e.g. A→C→B
            // ordering where B bridges phone-only A and email-only C), merge
            // the secondary contact into resolvedKey retroactively.
            const mergeSecondary = (secondaryKey: string) => {
              if (secondaryKey === resolvedKey || !contactMap.has(secondaryKey))
                return
              skippedDuplicate++
              childNamesByKey
                .get(secondaryKey)!
                .forEach((n) => childNamesByKey.get(resolvedKey)!.add(n))
              const primary = contactMap.get(resolvedKey)!
              const secondary = contactMap.get(secondaryKey)!
              if (!primary.phone && secondary.phone)
                primary.phone = secondary.phone
              if (!primary.email && secondary.email)
                primary.email = secondary.email
              fillVCardName(
                primary,
                secondary.firstName,
                secondary.lastName,
                secondary.fullName
              )
              for (const [k, v] of phoneToKey)
                if (v === secondaryKey) phoneToKey.set(k, resolvedKey)
              for (const [k, v] of emailToKey)
                if (v === secondaryKey) emailToKey.set(k, resolvedKey)
              contactMap.delete(secondaryKey)
              childNamesByKey.delete(secondaryKey)
            }

            if (formattedPhone) {
              const phoneKey = phoneToKey.get(formattedPhone)
              if (phoneKey !== undefined) mergeSecondary(phoneKey)
            }
            if (normalizedEmail) {
              const emailKey = emailToKey.get(normalizedEmail)
              if (emailKey !== undefined) mergeSecondary(emailKey)
            }

            const primaryContact = contactMap.get(resolvedKey)!
            if (formattedPhone && !primaryContact.phone)
              primaryContact.phone = formattedPhone
            if (normalizedEmail && !primaryContact.email)
              primaryContact.email = normalizedEmail
            fillVCardName(
              primaryContact,
              firstName,
              lastName,
              formatFullName(firstName, lastName)
            )

            if (formattedPhone) phoneToKey.set(formattedPhone, resolvedKey)
            if (normalizedEmail) emailToKey.set(normalizedEmail, resolvedKey)
            return
          }

          childNamesByKey.set(dedupeKey, new Set(memberNames))
          contactMap.set(dedupeKey, {
            firstName: firstName || '',
            lastName: lastName || '',
            fullName: formatFullName(firstName, lastName, 'Dugsi Parent'),
            phone: formattedPhone,
            email: normalizedEmail || undefined,
            organization,
          })
          if (formattedPhone) phoneToKey.set(formattedPhone, dedupeKey)
          if (normalizedEmail) emailToKey.set(normalizedEmail, dedupeKey)
        }

        addParent(
          first.parentFirstName,
          first.parentLastName,
          first.parentEmail,
          first.parentPhone,
          false
        )

        if (first.parent2Phone || first.parent2Email) {
          const p1Phone = formatPhoneForVCard(first.parentPhone) || ''
          const p2Phone = formatPhoneForVCard(first.parent2Phone) || ''
          const parent1Email = normalizeEmail(first.parentEmail)
          const parent2Email = normalizeEmail(first.parent2Email)
          const phoneOverlap = p1Phone !== '' && p1Phone === p2Phone
          const emailOverlap =
            parent1Email !== null && parent1Email === parent2Email
          const isIntraFamilyDuplicate = phoneOverlap || emailOverlap
          addParent(
            first.parent2FirstName,
            first.parent2LastName,
            first.parent2Email,
            first.parent2Phone,
            isIntraFamilyDuplicate
          )
        } else if (first.parent2FirstName || first.parent2LastName) {
          skippedNoContact++
        }
      }

      for (const [key, contact] of contactMap.entries()) {
        const children = childNamesByKey.get(key)!
        contact.note = `Children: ${[...children].join(', ')}`
      }

      const contacts = Array.from(contactMap.values())

      logger.info(
        {
          exported: contacts.length,
          skippedNoContact,
          skippedDuplicate,
          skippedChurned,
          skippedWithdrawn,
          totalFamilies: familyMap.size, // vCard grouping: phone-normalized, may differ from UI family count
          includeChurned,
          shift,
        },
        'Dugsi contacts exported'
      )

      return {
        content: generateVCardsContent(contacts),
        filename,
        exported: contacts.length,
        skippedNoContact,
        skippedDuplicate,
        skippedChurned,
        skippedWithdrawn,
      }
    }
  )

export async function getDugsiRegistrations(
  ...args: Parameters<typeof _getDugsiRegistrations>
) {
  return _getDugsiRegistrations(...args)
}
export async function generateDugsiVCardContent(
  ...args: Parameters<typeof _generateDugsiVCardContent>
) {
  return _generateDugsiVCardContent(...args)
}
