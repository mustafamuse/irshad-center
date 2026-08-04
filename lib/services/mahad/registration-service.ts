import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  Prisma,
  StudentBillingType,
} from '@prisma/client'

import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { prisma } from '@/lib/db'
import { createMahadRegistrationEnrollment } from '@/lib/db/queries/enrollment'
import {
  createPerson,
  findPersonByEmailExcluding,
  findPersonByPhoneExcluding,
  updatePersonFields,
} from '@/lib/db/queries/person'
import {
  createProgramProfileRecord,
  findContactlessMahadPersonsByName,
  findProgramProfileForMahadInvite,
  updateProgramProfileFields,
} from '@/lib/db/queries/program-profile'
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
  inviteProfileId?: string | null
}

type EnrichableProfile = {
  id: string
  gradeLevel: GradeLevel | null
  schoolName: string | null
  graduationStatus: GraduationStatus | null
  paymentFrequency: PaymentFrequency | null
  billingType: StudentBillingType | null
  paymentNotes: string | null
  person: {
    id: string
    email: string | null
    phone: string | null
    dateOfBirth: Date | null
  }
  enrollments: { id: string }[]
}

async function enrichExistingProfile(
  tx: Prisma.TransactionClient,
  profile: EnrichableProfile,
  input: MahadRegistrationInput,
  normalizedEmail: string | null,
  normalizedPhone: string | null,
  skip?: { email?: boolean; phone?: boolean }
): Promise<{ profileId: string }> {
  const personUpdates: Prisma.PersonUpdateInput = {}
  if (normalizedEmail && !profile.person.email && !skip?.email)
    personUpdates.email = normalizedEmail
  if (normalizedPhone && !profile.person.phone && !skip?.phone)
    personUpdates.phone = normalizedPhone
  if (input.dateOfBirth && !profile.person.dateOfBirth)
    personUpdates.dateOfBirth = input.dateOfBirth
  if (Object.keys(personUpdates).length > 0) {
    await updatePersonFields(profile.person.id, personUpdates, tx)
  }

  const profileUpdates: Prisma.ProgramProfileUpdateInput = {}
  if (input.gradeLevel && !profile.gradeLevel)
    profileUpdates.gradeLevel = input.gradeLevel
  if (input.schoolName && !profile.schoolName)
    profileUpdates.schoolName = input.schoolName
  if (input.graduationStatus && !profile.graduationStatus)
    profileUpdates.graduationStatus = input.graduationStatus
  if (input.paymentFrequency && !profile.paymentFrequency)
    profileUpdates.paymentFrequency = input.paymentFrequency
  if (input.billingType && !profile.billingType)
    profileUpdates.billingType = input.billingType
  if (input.paymentNotes) {
    profileUpdates.paymentNotes = profile.paymentNotes
      ? `${profile.paymentNotes}; ${input.paymentNotes}`
      : input.paymentNotes
  }
  if (Object.keys(profileUpdates).length > 0) {
    await updateProgramProfileFields(profile.id, profileUpdates, tx)
  }

  if (profile.enrollments.length === 0) {
    await createMahadRegistrationEnrollment(profile.id, input.batchId, tx)
  }

  return { profileId: profile.id }
}

/**
 * Public-flow registration write. Creates Person (or reuses + fills nulls if
 * the contact already exists in another program) + ProgramProfile + initial
 * Enrollment, atomically. Returns only the fields the caller needs to redirect
 * the user to the stable success URL — never the full profile row.
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

      if (input.inviteProfileId) {
        const invited = await findProgramProfileForMahadInvite(
          input.inviteProfileId,
          tx
        )
        if (invited && invited.program === MAHAD_PROGRAM) {
          // checkDuplicate does a single findFirst over OR(email, phone) and
          // returns at most one conflicting Person. If the submitted email and
          // phone belong to two DIFFERENT third-party Persons, only one
          // conflict is reported there — writing the other field onto the
          // invited Person would still violate the unique constraint and
          // abort the transaction, making the invite link unusable. So each
          // field that would actually be written here gets its own ownership
          // check against a different Person.
          const willWriteEmail =
            normalizedEmail !== null && !invited.person.email
          const willWritePhone =
            normalizedPhone !== null && !invited.person.phone

          const [emailOwner, phoneOwner] = await Promise.all([
            willWriteEmail
              ? findPersonByEmailExcluding(
                  normalizedEmail!,
                  invited.person.id,
                  tx
                )
              : null,
            willWritePhone
              ? findPersonByPhoneExcluding(
                  normalizedPhone!,
                  invited.person.id,
                  tx
                )
              : null,
          ])

          const skip = {
            email: emailOwner !== null,
            phone: phoneOwner !== null,
          }

          return enrichExistingProfile(
            tx,
            invited,
            input,
            normalizedEmail,
            normalizedPhone,
            skip
          )
        }
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
          await updatePersonFields(personId, contactUpdates, tx)
        }
      } else {
        const fallbackMatches = await findContactlessMahadPersonsByName(
          input.name,
          MAHAD_PROGRAM,
          tx
        )

        // Contact-less persons with a Mahad profile can only come from the
        // recovery backfill: mahadRegistrationSchema requires email and
        // phone, so every form-created person has contact info. That is
        // what makes exactly-one an auto-merge-safe condition.
        if (fallbackMatches.length === 1) {
          const match = fallbackMatches[0]
          const profile = match.programProfiles[0]
          return enrichExistingProfile(
            tx,
            {
              ...profile,
              person: {
                id: match.id,
                email: match.email,
                phone: match.phone,
                dateOfBirth: match.dateOfBirth,
              },
            },
            input,
            normalizedEmail,
            normalizedPhone
          )
        }

        const newPerson = await createPerson(
          {
            name: input.name,
            dateOfBirth: input.dateOfBirth ?? null,
            email: normalizedEmail,
            phone: normalizedPhone,
          },
          tx
        )
        personId = newPerson.id
      }

      const profile = await createProgramProfileRecord(
        {
          personId,
          program: MAHAD_PROGRAM,
          gradeLevel: input.gradeLevel ?? null,
          schoolName: input.schoolName ?? null,
          graduationStatus: input.graduationStatus ?? null,
          paymentFrequency: input.paymentFrequency ?? null,
          billingType: input.billingType ?? null,
          paymentNotes: input.paymentNotes ?? null,
        },
        tx
      )

      await createMahadRegistrationEnrollment(profile.id, input.batchId, tx)

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
