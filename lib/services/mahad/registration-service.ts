import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  Prisma,
  StudentBillingType,
} from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import {
  ActionError,
  ERROR_CODES,
  throwIfP2002,
} from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection-service'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'

const logger = createServiceLogger('mahad-registration-service')

export interface MahadRegistrationInput {
  name: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  graduationStatus?: GraduationStatus | null
  paymentFrequency?: PaymentFrequency | null
  billingType?: StudentBillingType | null
  paymentNotes?: string | null
  batchId?: string | null
}

/**
 * Public-flow registration write. Creates Person (or reuses + fills nulls if
 * the contact already exists in another program) + ProgramProfile + initial
 * Enrollment, atomically. Returns only the fields the caller needs to redirect
 * the user to the stable success URL — never the full profile row.
 *
 * TODO(rule-21): the transactional create chain currently calls
 * `tx.person.create / programProfile.create / enrollment.create` directly
 * rather than going through `lib/db/queries/*`. This is one of the files
 * grandfathered in `.claude/rules/dry-catalog.md`; refactor to query helpers
 * is tracked separately to keep this PR focused.
 */
export async function registerMahadStudent(
  input: MahadRegistrationInput
): Promise<{ profileId: string }> {
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedPhone = input.phone
    ? (normalizePhone(input.phone) ?? null)
    : null

  try {
    return await prisma.$transaction(async (tx) => {
      const dupResult = await DuplicateDetectionService.checkDuplicate(
        {
          email: normalizedEmail,
          phone: normalizedPhone,
          program: MAHAD_PROGRAM,
        },
        tx
      )

      if (dupResult.isDuplicate && dupResult.hasActiveProfile) {
        throw new ActionError(
          'Student already registered for Mahad',
          ERROR_CODES.DUPLICATE_CONTACT,
          dupResult.duplicateField === 'both'
            ? 'email'
            : (dupResult.duplicateField ?? 'email'),
          409
        )
      }

      let personId: string

      if (dupResult.existingPerson) {
        personId = dupResult.existingPerson.id

        const contactUpdates: Prisma.PersonUpdateInput = {}
        if (normalizedEmail !== null && !dupResult.existingPerson.email)
          contactUpdates.email = normalizedEmail
        if (normalizedPhone !== null && !dupResult.existingPerson.phone)
          contactUpdates.phone = normalizedPhone
        // Conservative merge fills null fields only (never overwrites). DOB
        // must be backfilled here or a reused Person (e.g. a Dugsi guardian
        // enrolling in Mahad) stays dateOfBirth=null forever and can never be
        // found by the public name+DOB lookup. Name is deliberately NOT
        // merged: it is never null, and registration flows have no authority
        // to overwrite it (admin flows do).
        if (input.dateOfBirth && !dupResult.existingPerson.dateOfBirth)
          contactUpdates.dateOfBirth = input.dateOfBirth

        if (Object.keys(contactUpdates).length > 0) {
          await tx.person.update({
            where: { id: personId },
            data: contactUpdates,
          })
        }
      } else {
        const newPerson = await tx.person.create({
          data: {
            name: input.name,
            dateOfBirth: input.dateOfBirth ?? null,
            email: normalizedEmail,
            phone: normalizedPhone,
          },
        })
        personId = newPerson.id
      }

      const profile = await tx.programProfile.create({
        data: {
          personId,
          program: MAHAD_PROGRAM,
          gradeLevel: input.gradeLevel ?? null,
          schoolName: input.schoolName ?? null,
          graduationStatus: input.graduationStatus ?? null,
          paymentFrequency: input.paymentFrequency ?? null,
          billingType: input.billingType ?? null,
          paymentNotes: input.paymentNotes ?? null,
        },
      })

      await tx.enrollment.create({
        data: {
          programProfileId: profile.id,
          batchId: input.batchId ?? null,
          status: 'REGISTERED',
          startDate: new Date(),
        },
      })

      return { profileId: profile.id }
    })
  } catch (error) {
    if (error instanceof ActionError) throw error
    throwIfP2002(error)
    await logError(logger, error, 'Failed to register Mahad student', {
      hasEmail: !!input.email,
      hasPhone: !!input.phone,
    })
    throw error
  }
}
