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
  EducationLevel,
  GradeLevel,
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
 * Phone format: XXX-XXX-XXXX or variations with optional +1 prefix
 */
const phoneRegex = /^(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/

/**
 * Schema for Person creation data
 */
const personDataSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
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
    .nullable()
    .optional(),
  isPrimaryEmail: z.boolean().optional(),
  isPrimaryPhone: z.boolean().optional(),
})

/**
 * Schema for child in family registration
 */
const childDataSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(255, 'First name is too long'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(255, 'Last name is too long'),
  dateOfBirth: z
    .date()
    .max(new Date(), 'Date of birth must be in the past')
    .nullable()
    .optional(),
  gender: z.nativeEnum(Gender).nullable().optional(),
  educationLevel: z.nativeEnum(EducationLevel).nullable().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).nullable().optional(),
  schoolName: z
    .string()
    .max(255, 'School name is too long')
    .nullable()
    .optional(),
  healthInfo: z.string().nullable().optional(),
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
  monthlyRate: z
    .number()
    .int('Monthly rate must be an integer')
    .min(0, 'Monthly rate must be non-negative')
    .max(100000, 'Monthly rate is too large')
    .optional(),
  customRate: z.boolean().optional(),
  gender: z.nativeEnum(Gender).nullable().optional(),
  educationLevel: z.nativeEnum(EducationLevel).nullable().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).nullable().optional(),
  schoolName: z
    .string()
    .max(255, 'School name is too long')
    .nullable()
    .optional(),
  healthInfo: z.string().nullable().optional(),
  familyReferenceId: z
    .string()
    .uuid('Family reference ID must be a valid UUID')
    .nullable()
    .optional(),
  highSchoolGradYear: z
    .number()
    .int('High school grad year must be an integer')
    .nullable()
    .optional(),
  highSchoolGraduated: z.boolean().nullable().optional(),
  collegeGradYear: z
    .number()
    .int('College grad year must be an integer')
    .nullable()
    .optional(),
  collegeGraduated: z.boolean().nullable().optional(),
  postGradYear: z
    .number()
    .int('Post grad year must be an integer')
    .nullable()
    .optional(),
  postGradCompleted: z.boolean().nullable().optional(),
  metadata: z.any().nullable().optional(),
  enrollmentReason: z.string().nullable().optional(),
  enrollmentNotes: z.string().nullable().optional(),
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
    .regex(phoneRegex, 'Parent 1 phone must be in format XXX-XXX-XXXX'),
  parent1FirstName: z
    .string()
    .min(1, 'Parent 1 first name is required')
    .max(255, 'Parent 1 first name is too long'),
  parent1LastName: z
    .string()
    .min(1, 'Parent 1 last name is required')
    .max(255, 'Parent 1 last name is too long'),
  parent2Email: z
    .string()
    .email('Parent 2 email must be valid')
    .toLowerCase()
    .nullable()
    .optional(),
  parent2Phone: z
    .string()
    .regex(phoneRegex, 'Parent 2 phone must be in format XXX-XXX-XXXX')
    .nullable()
    .optional(),
  parent2FirstName: z
    .string()
    .min(1, 'Parent 2 first name is required')
    .max(255, 'Parent 2 first name is too long')
    .nullable()
    .optional(),
  parent2LastName: z
    .string()
    .min(1, 'Parent 2 last name is required')
    .max(255, 'Parent 2 last name is too long')
    .nullable()
    .optional(),
  familyReferenceId: z
    .string()
    .uuid('Family reference ID must be a valid UUID'),
  monthlyRate: z
    .number()
    .int('Monthly rate must be an integer')
    .min(0, 'Monthly rate must be non-negative')
    .max(100000, 'Monthly rate is too large')
    .optional(),
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
                  value: normalizePhone(phone) || phone,
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
    monthlyRate = 150,
    customRate = false,
    gender,
    educationLevel,
    gradeLevel,
    schoolName,
    healthInfo,
    familyReferenceId,
    highSchoolGradYear,
    highSchoolGraduated,
    collegeGradYear,
    collegeGraduated,
    postGradYear,
    postGradCompleted,
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

  // Preliminary validation (checks Dugsi batchId constraint)
  // Pass program directly since profile doesn't exist yet
  // This is a quick fail check before starting transaction
  // The real validation with transaction client happens inside createEnrollment
  await validateEnrollment({
    program,
    batchId,
    status,
  })

  logger.info(
    { personId, program },
    'Preliminary validation passed, proceeding with profile creation'
  )

  // Define the operation that creates profile and enrollment
  const createProfileAndEnrollment = async (
    client: Prisma.TransactionClient
  ) => {
    logger.info(
      {
        personId,
        program,
        status,
        batchId,
      },
      'Creating program profile within transaction'
    )

    // Create ProgramProfile
    const profile = await client.programProfile.create({
      data: {
        personId,
        program,
        status,
        monthlyRate,
        customRate,
        gender,
        educationLevel,
        gradeLevel,
        schoolName,
        healthInfo,
        familyReferenceId,
        highSchoolGradYear,
        highSchoolGraduated,
        collegeGradYear,
        collegeGraduated,
        postGradYear,
        postGradCompleted,
        metadata: metadata === null ? Prisma.JsonNull : metadata,
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
 * Creates Person + ContactPoint for parents and links via GuardianRelationship
 * Creates or reuses BillingAccount for primary parent
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
    familyReferenceId,
    monthlyRate = 150,
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
        // Create new Person for child
        const newChildPerson = await tx.person.create({
          data: {
            name: childFullName,
            dateOfBirth: child.dateOfBirth,
          },
        })
        childPerson = { id: newChildPerson.id, name: newChildPerson.name }
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
            monthlyRate,
            gender: child.gender,
            educationLevel: child.educationLevel,
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
    if (createdProfiles.length > 1) {
      for (let i = 0; i < createdProfiles.length; i++) {
        for (let j = i + 1; j < createdProfiles.length; j++) {
          // Use transaction-aware sibling creation
          const [p1, p2] = [
            createdProfiles[i].personId,
            createdProfiles[j].personId,
          ].sort()

          // Check if relationship already exists
          const existingSibling = await tx.siblingRelationship.findFirst({
            where: {
              person1Id: p1,
              person2Id: p2,
            },
          })

          if (!existingSibling) {
            // Import validation dynamically
            const { validateSiblingRelationship } = await import(
              '@/lib/services/validation-service'
            )

            await validateSiblingRelationship({
              person1Id: p1,
              person2Id: p2,
            })

            await tx.siblingRelationship.create({
              data: {
                person1Id: p1,
                person2Id: p2,
                detectionMethod: 'manual',
                confidence: null,
                isActive: true,
              },
            })
          } else if (!existingSibling.isActive) {
            // Reactivate if inactive
            await tx.siblingRelationship.update({
              where: { id: existingSibling.id },
              data: {
                isActive: true,
                detectionMethod: 'manual',
              },
            })
          }
        }
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
                    value: normalizePhone(phone) || phone,
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
  },
  tx?: Prisma.TransactionClient
) {
  const { guardianPersonId, dependentPersonId, role = 'PARENT', notes } = data
  const client = tx || prisma

  // Check if relationship already exists
  const existing = await client.guardianRelationship.findFirst({
    where: {
      guardianId: guardianPersonId,
      dependentId: dependentPersonId,
    },
  })

  if (existing) {
    // Reactivate if inactive
    if (!existing.isActive) {
      return client.guardianRelationship.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          role,
          notes,
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
    },
  })
}
