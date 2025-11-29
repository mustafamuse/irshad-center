/**
 * Registration Service
 *
 * Service for creating Person, ProgramProfile, Enrollment, and related records
 * during registration flows (Dugsi, Mahad, etc.).
 */

import {
  Prisma,
  Program,
  EnrollmentStatus,
  ContactType,
  GuardianRole,
  Gender,
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { createEnrollment } from '@/lib/db/queries/enrollment'
import { findPersonByContact } from '@/lib/db/queries/program-profile'
import { createServiceLogger } from '@/lib/logger'
import { validateEnrollment } from '@/lib/services/validation-service'
import { normalizePhone } from '@/lib/utils/contact-normalization'

const logger = createServiceLogger('registration')

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * US Phone format validation regex.
 *
 * Accepts: XXX-XXX-XXXX or variations with optional +1 prefix
 * Examples: 612-555-1234, (612) 555-1234, +1-612-555-1234
 *
 * @note This regex is intentionally US-focused as the organization
 *       primarily serves a US-based community. International phone
 *       support may be added in the future if needed.
 *
 * @see normalizePhone() in utils/contact-normalization.ts for E.164 conversion
 */
const phoneRegex = /^(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/

/**
 * Sanitized name schema - prevents XSS by rejecting HTML tags
 * Trims whitespace and validates length
 *
 * @note Allows apostrophes, hyphens, accented characters, and math symbols
 * @note Rejects HTML-like patterns: <script>, <div>, <!-- -->
 * @note Allows single < or > when not forming HTML tags (e.g., "Name < Smith")
 *
 * @example
 * sanitizedNameSchema('Name').parse("<script>")      // Throws
 */
const sanitizedNameSchema = (fieldName: string) =>
  z
    .string()
    .min(1, `${fieldName} is required`)
    .max(255, `${fieldName} is too long`)
    .transform((str) => str.trim())
    .refine((str) => !/<[^>]+>/.test(str), {
      message: `${fieldName} cannot contain HTML tags`,
    })

/**
 * Schema for Person creation data
 */
const personDataSchema = z.object({
  name: sanitizedNameSchema('Name'),
  dateOfBirth: z
    .date()
    .max(new Date(), 'Date of birth must be in the past')
    .nullable()
    .optional(),
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .nullable()
    .optional(),
  phone: z
    .string()
    .regex(phoneRegex, 'Phone must be in format XXX-XXX-XXXX')
    .refine((phone) => !phone || normalizePhone(phone) !== null, {
      message: 'Invalid phone number - cannot be normalized',
    })
    .nullable()
    .optional(),
  isPrimaryEmail: z.boolean().optional(),
  isPrimaryPhone: z.boolean().optional(),
})

/**
 * Schema for child in family registration
 */
const childDataSchema = z.object({
  firstName: sanitizedNameSchema('First name'),
  lastName: sanitizedNameSchema('Last name'),
  dateOfBirth: z
    .date()
    .max(new Date(), 'Date of birth must be in the past')
    .nullable()
    .optional(),
  gender: z.nativeEnum(Gender).nullable().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).nullable().optional(),
  schoolName: z
    .string()
    .max(255, 'School name is too long')
    .nullable()
    .optional(),
  healthInfo: z
    .string()
    .max(5000, 'Health information is too long (max 5000 characters)')
    .nullable()
    .optional(),
})

/**
 * Schema for ProgramProfile creation data
 */
const programProfileDataSchema = z.object({
  personId: z.string().uuid('Person ID must be a valid UUID'),
  program: z.nativeEnum(Program),
  status: z.nativeEnum(EnrollmentStatus).optional(),
  batchId: z
    .string()
    .uuid('Batch ID must be a valid UUID')
    .nullable()
    .optional(),
  gender: z.nativeEnum(Gender).nullable().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).nullable().optional(),
  schoolName: z
    .string()
    .max(255, 'School name is too long')
    .nullable()
    .optional(),
  healthInfo: z
    .string()
    .max(5000, 'Health information is too long (max 5000 characters)')
    .nullable()
    .optional(),
  familyReferenceId: z
    .string()
    .uuid('Family reference ID must be a valid UUID')
    .nullable()
    .optional(),
  // Mahad billing fields (nullable for non-Mahad profiles)
  graduationStatus: z.nativeEnum(GraduationStatus).nullable().optional(),
  paymentFrequency: z.nativeEnum(PaymentFrequency).nullable().optional(),
  billingType: z.nativeEnum(StudentBillingType).nullable().optional(),
  paymentNotes: z
    .string()
    .max(500, 'Payment notes is too long (max 500 characters)')
    .nullable()
    .optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  enrollmentReason: z
    .string()
    .max(2000, 'Enrollment reason is too long (max 2000 characters)')
    .nullable()
    .optional(),
  enrollmentNotes: z
    .string()
    .max(2000, 'Enrollment notes is too long (max 2000 characters)')
    .nullable()
    .optional(),
})

/**
 * Schema for family registration data
 */
const familyRegistrationSchema = z.object({
  children: z
    .array(childDataSchema)
    .min(1, 'At least one child is required')
    .max(10, 'Maximum 10 children allowed'),
  parent1Email: z.string().email('Parent 1 email must be valid').toLowerCase(),
  parent1Phone: z
    .string()
    .regex(phoneRegex, 'Parent 1 phone must be in format XXX-XXX-XXXX')
    .refine((phone) => normalizePhone(phone) !== null, {
      message: 'Parent 1 phone is invalid - cannot be normalized',
    }),
  parent1FirstName: sanitizedNameSchema('Parent 1 first name'),
  parent1LastName: sanitizedNameSchema('Parent 1 last name'),
  parent2Email: z
    .string()
    .email('Parent 2 email must be valid')
    .toLowerCase()
    .nullable()
    .optional(),
  parent2Phone: z
    .string()
    .regex(phoneRegex, 'Parent 2 phone must be in format XXX-XXX-XXXX')
    .refine((phone) => !phone || normalizePhone(phone) !== null, {
      message: 'Parent 2 phone is invalid - cannot be normalized',
    })
    .nullable()
    .optional(),
  parent2FirstName: sanitizedNameSchema('Parent 2 first name')
    .nullable()
    .optional(),
  parent2LastName: sanitizedNameSchema('Parent 2 last name')
    .nullable()
    .optional(),
  primaryPayer: z.enum(['parent1', 'parent2']).default('parent1'),
  familyReferenceId: z
    .string()
    .uuid('Family reference ID must be a valid UUID'),
})

/**
 * Create a Person with contact points
 * @param data - Person data including name, dateOfBirth, email, phone
 * @param tx - Optional Prisma transaction client for atomic operations
 */
export async function createPersonWithContact(
  data: unknown,
  tx?: Prisma.TransactionClient
) {
  // Validate at service boundary
  const validated = personDataSchema.parse(data)

  const {
    name,
    dateOfBirth,
    email,
    phone,
    isPrimaryEmail = true,
    isPrimaryPhone = true,
  } = validated

  logger.info(
    {
      name,
      hasEmail: !!email,
      hasPhone: !!phone,
      usingTransactionClient: !!tx,
    },
    'Creating person with contact points'
  )

  // Use transaction client if provided, otherwise use prisma
  const client = tx || prisma

  const person = await client.person.create({
    data: {
      name,
      dateOfBirth,
      contactPoints: {
        create: [
          ...(email
            ? [
                {
                  type: 'EMAIL' as ContactType,
                  value: email.toLowerCase().trim(),
                  isPrimary: isPrimaryEmail,
                },
              ]
            : []),
          ...(phone
            ? [
                {
                  type: 'PHONE' as ContactType,
                  value: (() => {
                    const normalized = normalizePhone(phone)
                    if (!normalized) {
                      const digits = phone.replace(/\D/g, '')
                      // Log detailed error for debugging (server-side only)
                      logger.error(
                        {
                          name,
                          phone,
                          digitCount: digits.length,
                          expectedDigits: '10-15',
                        },
                        'Phone normalization failed during person creation'
                      )
                      // Throw sanitized error message (safe for client)
                      throw new Error(
                        `Invalid phone number format (${digits.length} digits found, expected 10-15 for E.164 format)`
                      )
                    }
                    return normalized
                  })(),
                  isPrimary: isPrimaryPhone,
                },
              ]
            : []),
        ],
      },
    },
    include: {
      contactPoints: true,
    },
  })

  logger.info(
    {
      personId: person.id,
      name: person.name,
      contactPointCount: person.contactPoints.length,
    },
    'Person created successfully with contact points'
  )

  return person
}

/**
 * Create a ProgramProfile with initial Enrollment
 * @param data - Program profile data including personId, program, status, etc.
 * @param tx - Optional Prisma transaction client for atomic operations
 */
export async function createProgramProfileWithEnrollment(
  data: unknown,
  tx?: Prisma.TransactionClient
) {
  // Validate at service boundary
  const validated = programProfileDataSchema.parse(data)

  const {
    personId,
    program,
    status = 'REGISTERED' as EnrollmentStatus,
    batchId,
    gender,
    gradeLevel,
    schoolName,
    healthInfo,
    familyReferenceId,
    // Mahad billing fields
    graduationStatus,
    paymentFrequency,
    billingType,
    paymentNotes,
    metadata,
    enrollmentReason,
    enrollmentNotes,
  } = validated

  logger.info(
    {
      personId,
      program,
      status,
      batchId,
      usingTransactionClient: !!tx,
    },
    'Starting ProgramProfile creation with enrollment'
  )

  // Note: Full validation happens inside the transaction to prevent TOCTOU issues
  // The validateEnrollment call is made with the transaction client to ensure
  // batch existence is checked atomically with profile creation

  // Define the operation that creates profile and enrollment
  const createProfileAndEnrollment = async (
    client: Prisma.TransactionClient
  ) => {
    // Validate enrollment inside transaction to prevent TOCTOU race conditions
    // This ensures batch existence check is atomic with profile creation
    await validateEnrollment(
      {
        program,
        batchId,
        status,
      },
      client
    )

    logger.info(
      {
        personId,
        program,
        status,
        batchId,
      },
      'Validation passed, creating program profile within transaction'
    )

    // Check for existing profile with active enrollments to prevent duplicates
    // Allows re-registration if all previous enrollments were withdrawn
    const existingProfile = await client.programProfile.findFirst({
      where: { personId, program },
      include: {
        enrollments: {
          where: {
            status: { not: 'WITHDRAWN' },
            endDate: null,
          },
        },
      },
    })

    if (existingProfile && existingProfile.enrollments.length > 0) {
      logger.warn(
        {
          personId,
          program,
          existingProfileId: existingProfile.id,
          activeEnrollments: existingProfile.enrollments.length,
        },
        'Person already has an active enrollment for this program'
      )
      throw new Error(
        `Person already has an active ${program} enrollment (Profile ID: ${existingProfile.id}). ` +
          'Withdraw the existing enrollment first before re-registering.'
      )
    }

    // Create ProgramProfile
    const profile = await client.programProfile.create({
      data: {
        personId,
        program,
        status,
        gender,
        gradeLevel,
        schoolName,
        healthInfo,
        familyReferenceId,
        // Mahad billing fields
        graduationStatus,
        paymentFrequency,
        billingType,
        paymentNotes,
        metadata:
          metadata === null
            ? Prisma.JsonNull
            : (metadata as Prisma.InputJsonValue),
      },
    })

    logger.info(
      {
        profileId: profile.id,
        personId: profile.personId,
        program: profile.program,
      },
      'Program profile created successfully, creating enrollment'
    )

    // Create initial Enrollment
    const enrollment = await createEnrollment(
      {
        programProfileId: profile.id,
        batchId,
        status,
        reason: enrollmentReason,
        notes: enrollmentNotes,
      },
      client // Pass transaction client
    )

    logger.info(
      {
        enrollmentId: enrollment.id,
        profileId: profile.id,
        status: enrollment.status,
      },
      'Enrollment created successfully'
    )

    return {
      profile,
      enrollment,
    }
  }

  // If transaction client is provided, we're already in a transaction
  // Don't create a nested transaction
  if (tx) {
    return createProfileAndEnrollment(tx)
  }

  // Otherwise, create a new transaction
  return prisma.$transaction(createProfileAndEnrollment)
}

/**
 * Create a family registration (Dugsi multi-child registration)
 *
 * Creates Person + ContactPoint for parents and links via GuardianRelationship.
 * Creates or reuses BillingAccount for primary parent.
 * Also creates sibling relationships between children.
 *
 * @param data - Family registration data (validated against familyRegistrationSchema)
 * @returns Object with created profiles and billing account
 *
 * @example
 * ```typescript
 * const result = await createFamilyRegistration({
 *   children: [
 *     { firstName: 'Ahmed', lastName: 'Ali', dateOfBirth: new Date('2015-01-15') },
 *     { firstName: 'Fatima', lastName: 'Ali', dateOfBirth: new Date('2017-03-20') }
 *   ],
 *   parent1Email: 'parent@example.com',
 *   parent1Phone: '612-555-1234',
 *   parent1FirstName: 'Mohammed',
 *   parent1LastName: 'Ali',
 *   familyReferenceId: crypto.randomUUID(),
 * })
 * // Returns: { profiles: [...], billingAccount: { id, primaryContactPointId } }
 * ```
 *
 * @throws {ZodError} If data validation fails
 * @throws {Error} If phone normalization fails
 */
export async function createFamilyRegistration(data: unknown): Promise<{
  profiles: Array<{ id: string; name: string; personId: string }>
  billingAccount: { id: string; primaryContactPointId: string | null }
}> {
  // Validate at service boundary
  const validated = familyRegistrationSchema.parse(data)

  const {
    children,
    parent1Email,
    parent1Phone,
    parent1FirstName,
    parent1LastName,
    parent2Email,
    parent2Phone,
    parent2FirstName,
    parent2LastName,
    primaryPayer,
    familyReferenceId,
  } = validated

  return prisma.$transaction(async (tx) => {
    const createdProfiles = []

    // Find or create Parent 1 Person with contact points
    const parent1FullName = `${parent1FirstName} ${parent1LastName}`
    const parent1Person = await findOrCreatePersonWithContact(
      {
        name: parent1FullName,
        email: parent1Email,
        phone: parent1Phone,
        isPrimaryEmail: true,
        isPrimaryPhone: true,
      },
      tx
    )

    // Find or create Parent 2 Person with contact points (if provided)
    let parent2Person: typeof parent1Person | null = null
    if (
      !validated.parent2Email &&
      !validated.parent2Phone &&
      !validated.parent2FirstName &&
      !validated.parent2LastName
    ) {
      // Single parent household - no parent 2
    } else if (
      parent2FirstName &&
      parent2LastName &&
      parent2Email &&
      parent2Phone
    ) {
      const parent2FullName = `${parent2FirstName} ${parent2LastName}`
      parent2Person = await findOrCreatePersonWithContact(
        {
          name: parent2FullName,
          email: parent2Email,
          phone: parent2Phone,
          isPrimaryEmail: true,
          isPrimaryPhone: true,
        },
        tx
      )
    }

    // Create or get billing account for parent 1 (within transaction)
    const primaryEmailContact = parent1Person.contactPoints.find(
      (cp) => cp.type === 'EMAIL' && cp.isPrimary
    )

    // Check if billing account already exists
    const existingBillingAccount = await tx.billingAccount.findFirst({
      where: {
        personId: parent1Person.id,
        accountType: 'DUGSI',
      },
    })

    let billingAccount
    if (existingBillingAccount) {
      // Update primary contact if needed
      if (
        primaryEmailContact &&
        existingBillingAccount.primaryContactPointId !== primaryEmailContact.id
      ) {
        billingAccount = await tx.billingAccount.update({
          where: { id: existingBillingAccount.id },
          data: {
            primaryContactPointId: primaryEmailContact.id,
          },
        })
      } else {
        billingAccount = existingBillingAccount
      }
    } else {
      // Create new billing account
      billingAccount = await tx.billingAccount.create({
        data: {
          personId: parent1Person.id,
          accountType: 'DUGSI',
          primaryContactPointId: primaryEmailContact?.id || null,
        },
      })
    }

    // Create each child
    for (const child of children) {
      const childFullName = `${child.firstName} ${child.lastName}`

      // Check if child already exists
      const existingChild = await findExistingChild(
        child.firstName,
        child.lastName,
        child.dateOfBirth,
        tx
      )

      let childPerson: { id: string; name: string }
      if (existingChild) {
        // Use existing child person
        childPerson = existingChild
      } else {
        // Create new Person for child with P2002 race condition handling
        try {
          const newChildPerson = await tx.person.create({
            data: {
              name: childFullName,
              dateOfBirth: child.dateOfBirth,
            },
          })
          childPerson = { id: newChildPerson.id, name: newChildPerson.name }
        } catch (error) {
          // Handle race condition: another transaction created this child
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            logger.info(
              { name: childFullName, dateOfBirth: child.dateOfBirth },
              'Child person already exists (race condition), fetching existing'
            )
            const raceConditionChild = await findExistingChild(
              child.firstName,
              child.lastName,
              child.dateOfBirth,
              tx
            )
            if (raceConditionChild) {
              childPerson = raceConditionChild
            } else {
              // Child not found by name+DOB, might be a different unique constraint
              throw error
            }
          } else {
            throw error
          }
        }
      }

      // Check if child already has a Dugsi ProgramProfile
      const existingProfile = await tx.programProfile.findFirst({
        where: {
          personId: childPerson.id,
          program: 'DUGSI_PROGRAM',
        },
      })

      let profile
      if (existingProfile) {
        profile = existingProfile
      } else {
        // Create ProgramProfile for child
        profile = await tx.programProfile.create({
          data: {
            personId: childPerson.id,
            program: 'DUGSI_PROGRAM',
            status: 'REGISTERED',
            gender: child.gender,
            gradeLevel: child.gradeLevel,
            schoolName: child.schoolName,
            healthInfo: child.healthInfo,
            familyReferenceId,
          },
        })

        // Create Enrollment (no batchId for Dugsi)
        await tx.enrollment.create({
          data: {
            programProfileId: profile.id,
            batchId: null, // Dugsi doesn't use batches
            status: 'REGISTERED',
          },
        })
      }

      // Link guardian relationships using helper function
      await linkGuardianToDependent(
        {
          guardianPersonId: parent1Person.id,
          dependentPersonId: childPerson.id,
          role: 'PARENT',
          isPrimaryPayer: primaryPayer === 'parent1',
        },
        tx
      )

      // Create GuardianRelationship for parent 2 → child (if parent 2 exists)
      if (parent2Person) {
        await linkGuardianToDependent(
          {
            guardianPersonId: parent2Person.id,
            dependentPersonId: childPerson.id,
            role: 'PARENT',
            isPrimaryPayer: primaryPayer === 'parent2',
          },
          tx
        )
      }

      createdProfiles.push({
        id: profile.id,
        name: childFullName,
        personId: childPerson.id,
      })
    }

    // Create sibling relationships if multiple children (within transaction)
    // Optimized to batch check existing relationships first
    if (createdProfiles.length > 1) {
      // Build all sibling pairs with consistent ordering (p1 < p2)
      const siblingPairs: Array<{ p1: string; p2: string }> = []
      for (let i = 0; i < createdProfiles.length; i++) {
        for (let j = i + 1; j < createdProfiles.length; j++) {
          const [p1, p2] = [
            createdProfiles[i].personId,
            createdProfiles[j].personId,
          ].sort()
          siblingPairs.push({ p1, p2 })
        }
      }

      // Batch fetch all existing sibling relationships
      const existingRelationships = await tx.siblingRelationship.findMany({
        where: {
          OR: siblingPairs.map(({ p1, p2 }) => ({
            person1Id: p1,
            person2Id: p2,
          })),
        },
      })

      // Create a map for quick lookup
      const existingMap = new Map(
        existingRelationships.map((r) => [`${r.person1Id}-${r.person2Id}`, r])
      )

      // Prepare batch operations
      const toCreate: Array<{
        person1Id: string
        person2Id: string
        detectionMethod: string
        confidence: null
        isActive: boolean
      }> = []
      const toReactivate: string[] = []

      for (const { p1, p2 } of siblingPairs) {
        const existing = existingMap.get(`${p1}-${p2}`)
        if (!existing) {
          toCreate.push({
            person1Id: p1,
            person2Id: p2,
            detectionMethod: 'manual',
            confidence: null,
            isActive: true,
          })
        } else if (!existing.isActive) {
          toReactivate.push(existing.id)
        }
      }

      // Batch create new relationships
      if (toCreate.length > 0) {
        await tx.siblingRelationship.createMany({
          data: toCreate,
          skipDuplicates: true,
        })
      }

      // Batch reactivate inactive relationships
      if (toReactivate.length > 0) {
        await tx.siblingRelationship.updateMany({
          where: { id: { in: toReactivate } },
          data: {
            isActive: true,
            detectionMethod: 'manual',
          },
        })
      }
    }

    return {
      profiles: createdProfiles,
      billingAccount: {
        id: billingAccount.id,
        primaryContactPointId: billingAccount.primaryContactPointId,
      },
    }
  })
}

/**
 * Find or create a Person with contact points
 * Reuses existing Person if found by email/phone, otherwise creates new one
 */
async function findOrCreatePersonWithContact(
  data: {
    name: string
    dateOfBirth?: Date | null
    email?: string | null
    phone?: string | null
    isPrimaryEmail?: boolean
    isPrimaryPhone?: boolean
  },
  tx?: Prisma.TransactionClient
): Promise<{
  id: string
  name: string
  contactPoints: Array<{
    id: string
    type: ContactType
    value: string
    isPrimary: boolean
  }>
}> {
  const {
    name,
    dateOfBirth,
    email,
    phone,
    isPrimaryEmail = true,
    isPrimaryPhone = true,
  } = data
  const client = tx || prisma

  // Try to find existing person by contact
  if (email || phone) {
    const existingPerson = await findPersonByContact(
      email?.toLowerCase().trim() || null,
      phone ? normalizePhone(phone) || null : null,
      client // Pass transaction client for consistency
    )

    if (existingPerson) {
      // Found existing person - add missing contact points
      const contactPointsToCreate: Prisma.ContactPointCreateManyInput[] = []
      const existingEmails = existingPerson.contactPoints
        .filter((cp) => cp.type === 'EMAIL')
        .map((cp) => cp.value.toLowerCase())
      const existingPhones = existingPerson.contactPoints
        .filter((cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP')
        .map((cp) => normalizePhone(cp.value))

      if (email && !existingEmails.includes(email.toLowerCase().trim())) {
        contactPointsToCreate.push({
          personId: existingPerson.id,
          type: 'EMAIL',
          value: email.toLowerCase().trim(),
          isPrimary: isPrimaryEmail,
        })
      }

      if (phone) {
        const normalizedPhone = normalizePhone(phone) || phone
        if (!existingPhones.includes(normalizedPhone)) {
          contactPointsToCreate.push({
            personId: existingPerson.id,
            type: 'PHONE',
            value: normalizedPhone,
            isPrimary: isPrimaryPhone,
          })
        }
      }

      if (contactPointsToCreate.length > 0) {
        await client.contactPoint.createMany({
          data: contactPointsToCreate,
          skipDuplicates: true,
        })
      }

      // Return updated person with contact points
      const updatedPerson = await client.person.findUnique({
        where: { id: existingPerson.id },
        include: { contactPoints: true },
      })

      return updatedPerson!
    }
  }

  // Create new person
  // Wrap in try-catch to handle race condition with unique constraint
  try {
    return await client.person.create({
      data: {
        name,
        dateOfBirth,
        contactPoints: {
          create: [
            ...(email
              ? [
                  {
                    type: 'EMAIL' as ContactType,
                    value: email.toLowerCase().trim(),
                    isPrimary: isPrimaryEmail,
                  },
                ]
              : []),
            ...(phone
              ? [
                  {
                    type: 'PHONE' as ContactType,
                    value: (() => {
                      const normalized = normalizePhone(phone)
                      if (!normalized) {
                        const digits = phone.replace(/\D/g, '')
                        // Log detailed error for debugging (server-side only)
                        logger.error(
                          {
                            name,
                            phone,
                            digitCount: digits.length,
                            expectedDigits: '10-15',
                          },
                          'Phone normalization failed during findOrCreate'
                        )
                        // Throw sanitized error message (safe for client)
                        throw new Error(
                          `Invalid phone number format (${digits.length} digits found, expected 10-15 for E.164 format)`
                        )
                      }
                      return normalized
                    })(),
                    isPrimary: isPrimaryPhone,
                  },
                ]
              : []),
          ],
        },
      },
      include: {
        contactPoints: true,
      },
    })
  } catch (error) {
    // If unique constraint violation on contact (race condition), retry find
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      error.meta?.target &&
      Array.isArray(error.meta.target) &&
      (error.meta.target.includes('type') ||
        error.meta.target.includes('value'))
    ) {
      logger.info(
        {
          email: email?.toLowerCase().trim() || null,
          phone: phone ? normalizePhone(phone) || null : null,
        },
        'Unique constraint violation caught - Person with this contact already exists, fetching'
      )

      // Another process created the person, find and return it
      const existingPerson = await findPersonByContact(
        email?.toLowerCase().trim() || null,
        phone ? normalizePhone(phone) || null : null,
        client // Pass transaction client for consistency
      )

      if (existingPerson) {
        logger.info({ personId: existingPerson.id }, 'Found existing Person')
        return existingPerson
      }
    }

    // Re-throw if not a unique constraint error or person not found
    throw error
  }
}

/**
 * Find existing child Person by name and date of birth
 */
async function findExistingChild(
  firstName: string,
  lastName: string,
  dateOfBirth: Date | null | undefined,
  tx?: Prisma.TransactionClient
): Promise<{ id: string; name: string } | null> {
  const client = tx || prisma
  const fullName = `${firstName} ${lastName}`.trim()

  if (!dateOfBirth) {
    return null
  }

  // Find person by name and DOB
  const existing = await client.person.findFirst({
    where: {
      name: {
        equals: fullName,
        mode: 'insensitive',
      },
      dateOfBirth: {
        equals: dateOfBirth,
      },
    },
    select: {
      id: true,
      name: true,
    },
  })

  return existing
}

/**
 * Link a guardian to a dependent (with optional transaction support)
 */
export async function linkGuardianToDependent(
  data: {
    guardianPersonId: string
    dependentPersonId: string
    role?: GuardianRole
    notes?: string | null
    isPrimaryPayer?: boolean
  },
  tx?: Prisma.TransactionClient
) {
  const {
    guardianPersonId,
    dependentPersonId,
    role = 'PARENT',
    notes,
    isPrimaryPayer = false,
  } = data
  const client = tx || prisma

  // Check if relationship already exists
  const existing = await client.guardianRelationship.findFirst({
    where: {
      guardianId: guardianPersonId,
      dependentId: dependentPersonId,
    },
  })

  if (existing) {
    // Update isPrimaryPayer or reactivate if inactive
    if (!existing.isActive || isPrimaryPayer !== existing.isPrimaryPayer) {
      return client.guardianRelationship.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          role,
          notes,
          isPrimaryPayer,
        },
      })
    }
    return existing
  }

  // Import validation dynamically to avoid circular dependencies
  const { validateGuardianRelationship } = await import(
    '@/lib/services/validation-service'
  )

  // Validate before creating
  await validateGuardianRelationship({
    guardianId: guardianPersonId,
    dependentId: dependentPersonId,
    role,
  })

  return client.guardianRelationship.create({
    data: {
      guardianId: guardianPersonId,
      dependentId: dependentPersonId,
      role,
      notes,
      isActive: true,
      isPrimaryPayer,
    },
  })
}
