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
  Shift,
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
// Key Normalization Helpers
// ============================================================================

/**
 * Normalized child identity key used for lookups
 * Format: "normalized_name|iso_date_string"
 */
type ChildLookupKey = string

/**
 * Generate normalized lookup key for child identity matching
 * Normalizes name (lowercase, trimmed, collapsed whitespace) and DOB (ISO string)
 *
 * @param fullName - Full name (e.g., "John Doe")
 * @param dateOfBirth - Optional date of birth
 * @returns Normalized key string
 */
function getChildLookupKey(
  fullName: string,
  dateOfBirth?: Date | null
): ChildLookupKey {
  const normalizedName = fullName.trim().replace(/\s+/g, ' ').toLowerCase()
  const dobKey = dateOfBirth ? dateOfBirth.toISOString() : ''
  return `${normalizedName}|${dobKey}`
}

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
  shift: z.nativeEnum(Shift).nullable().optional(),
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
  shift: z.nativeEnum(Shift).nullable().optional(),
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
    shift,
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
        `This person already has an active ${program} enrollment. ` +
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
        shift,
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
 * ## Execution Phases (Sequential, Non-Transactional)
 *
 * Due to Supavisor connection pooling constraints, this function uses sequential
 * operations without interactive transactions. Each phase is idempotent:
 *
 *
 * ## Recovery Strategy for Partial Failures
 *
 * If a failure occurs mid-registration:
 * - **Re-run registration**: All operations use upsert/skipDuplicates patterns,
 *   so re-submitting the same data will complete missing steps safely.
 * - **Manual recovery**: Use the logged `familyReferenceId` to query profiles
 *   and identify missing relationships.
 * - **Child reassignment blocked**: Existing children with a different
 *   familyReferenceId will throw an error to prevent accidental reassignment.
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
 * @throws {Error} If child is already registered under a different family
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

  // Sequential batch operations - no interactive transaction needed
  // Each operation is idempotent using upsert/skipDuplicates patterns
  // This works with Supavisor connection pooling (transaction mode)
  //
  // IMPORTANT: Without interactive transactions, partial failures are possible.
  // Each phase is idempotent, so re-running registration will complete missing steps.
  // We log the familyReferenceId to enable manual recovery if needed.

  logger.info({ familyReferenceId }, 'Starting family registration')

  const createdProfiles: Array<{
    id: string
    name: string
    personId: string
  }> = []

  let currentPhase = 'init'
  try {
    // Phase 0: Pre-flight validation (before any writes)
    // Catches family conflicts early to prevent orphaned data
    currentPhase = 'validation'
    await validateFamilyConflicts(children, familyReferenceId)

    // Phase 1: Find or create parents (parallel, each idempotent)
    currentPhase = 'parents'
    const parent1FullName = `${parent1FirstName} ${parent1LastName}`
    const hasParent2 =
      parent2FirstName && parent2LastName && parent2Email && parent2Phone
    const resolvedPrimaryPayer = hasParent2 ? primaryPayer : 'parent1'

    const [parent1Person, parent2Person] = await Promise.all([
      findOrCreatePersonWithContact({
        name: parent1FullName,
        email: parent1Email,
        phone: parent1Phone,
        isPrimaryEmail: true,
        isPrimaryPhone: true,
      }),
      hasParent2
        ? findOrCreatePersonWithContact({
            name: `${parent2FirstName} ${parent2LastName}`,
            email: parent2Email!,
            phone: parent2Phone!,
            isPrimaryEmail: true,
            isPrimaryPhone: true,
          })
        : Promise.resolve(null),
    ])

    // Phase 2: Create or get billing account (idempotent find-or-create)
    currentPhase = 'billing'
    const primaryEmailContact = parent1Person.contactPoints.find(
      (cp) => cp.type === 'EMAIL' && cp.isPrimary
    )

    const existingBillingAccount = await prisma.billingAccount.findFirst({
      where: {
        personId: parent1Person.id,
        accountType: 'DUGSI',
      },
    })

    let billingAccount
    if (existingBillingAccount) {
      // Update primary contact if changed
      if (
        primaryEmailContact &&
        existingBillingAccount.primaryContactPointId !== primaryEmailContact.id
      ) {
        billingAccount = await prisma.billingAccount.update({
          where: { id: existingBillingAccount.id },
          data: { primaryContactPointId: primaryEmailContact.id },
        })
      } else {
        billingAccount = existingBillingAccount
      }
    } else {
      // Create new billing account
      billingAccount = await prisma.billingAccount.create({
        data: {
          personId: parent1Person.id,
          accountType: 'DUGSI',
          primaryContactPointId: primaryEmailContact?.id || null,
        },
      })
    }

    // Phase 3: Create children sequentially with batch lookups
    // OPTIMIZATION: Batch lookups reduce N queries to 1 query each
    // Sequential processing avoids connection pool exhaustion
    currentPhase = 'children'

    // PHASE 1: Get or create all children, collect ALL person IDs
    // OPTIMIZATION 1: Batch lookup all existing children (1 query instead of N)
    const existingChildrenMap = await findExistingChildren(children)

    // Track ALL person IDs (both existing and newly created)
    const allChildPersons: Array<{ id: string; name: string }> = []

    // Get or create all children sequentially
    for (const child of children) {
      const childFullName = `${child.firstName} ${child.lastName}`
      const lookupKey = getChildLookupKey(childFullName, child.dateOfBirth)

      let childPerson = existingChildrenMap.get(lookupKey)

      if (!childPerson) {
        try {
          const newChildPerson = await prisma.person.create({
            data: {
              name: childFullName,
              dateOfBirth: child.dateOfBirth,
            },
          })
          childPerson = { id: newChildPerson.id, name: newChildPerson.name }
        } catch (error) {
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
              child.dateOfBirth
            )
            if (raceConditionChild) {
              childPerson = raceConditionChild
            } else {
              logger.error(
                {
                  name: childFullName,
                  dateOfBirth: child.dateOfBirth,
                  familyReferenceId,
                  prismaError: error.meta,
                },
                'P2002 but child not found - possible constraint mismatch'
              )
              throw new Error(
                `Registration temporarily unavailable for ${childFullName}. ` +
                  `Please retry. If the problem persists, contact support with reference: ${familyReferenceId}`
              )
            }
          } else {
            throw error
          }
        }
      }

      allChildPersons.push(childPerson)
    }

    // PHASE 2: Batch lookup profiles for ALL children, then process
    // OPTIMIZATION 2: Batch lookup profiles for ALL children (1 query instead of N)
    const allPersonIds = allChildPersons.map((p) => p.id)
    const existingProfilesMap = await findExistingDugsiProfiles(allPersonIds)

    // Process each child's profile sequentially
    const childResults: Array<{
      id: string
      name: string
      personId: string
    }> = []
    const profilesToCheckEnrollments: Array<{ id: string; personId: string }> =
      []

    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      const childPerson = allChildPersons[i]
      const childFullName = childPerson.name

      // Get profile from batch lookup
      const existingProfile = existingProfilesMap.get(childPerson.id)

      /**
       * Update existing profile - only update fields that are explicitly provided.
       *
       * Uses !== undefined && !== null checks intentionally:
       * - undefined: Field was not included in form submission (e.g., SHOW_GRADE_SCHOOL=false)
       * - null: Field was explicitly cleared (we still skip to preserve existing data)
       *
       * This prevents overwriting existing demographic data with empty form fields
       * when re-registering or updating a child's profile.
       */
      let profile
      if (existingProfile) {
        // Prevent reassigning child to a different family
        if (
          existingProfile.familyReferenceId &&
          existingProfile.familyReferenceId !== familyReferenceId
        ) {
          throw new Error(
            `Child ${childFullName} is already registered under a different family. ` +
              `Contact support to update family relationships.`
          )
        }

        profile = await prisma.programProfile.update({
          where: { id: existingProfile.id },
          data: {
            ...(child.gender !== undefined &&
              child.gender !== null && { gender: child.gender }),
            ...(child.gradeLevel !== undefined &&
              child.gradeLevel !== null && { gradeLevel: child.gradeLevel }),
            ...(child.shift !== undefined &&
              child.shift !== null && { shift: child.shift }),
            ...(child.schoolName !== undefined &&
              child.schoolName !== null && { schoolName: child.schoolName }),
            ...(child.healthInfo !== undefined &&
              child.healthInfo !== null && { healthInfo: child.healthInfo }),
            familyReferenceId,
          },
        })

        // Track for batch enrollment check
        profilesToCheckEnrollments.push({
          id: profile.id,
          personId: childPerson.id,
        })
      } else {
        profile = await prisma.programProfile.create({
          data: {
            personId: childPerson.id,
            program: 'DUGSI_PROGRAM',
            status: 'REGISTERED',
            gender: child.gender,
            gradeLevel: child.gradeLevel,
            shift: child.shift,
            schoolName: child.schoolName,
            healthInfo: child.healthInfo,
            familyReferenceId,
          },
        })

        // Track for batch enrollment creation
        profilesToCheckEnrollments.push({
          id: profile.id,
          personId: childPerson.id,
        })

        // Log student role addition
        logger.info(
          {
            event: 'ROLE_ADDED',
            personId: childPerson.id,
            personName: childFullName,
            role: 'STUDENT',
            program: 'DUGSI_PROGRAM',
            profileId: profile.id,
            timestamp: new Date().toISOString(),
          },
          'Person enrolled as Dugsi student'
        )
      }

      childResults.push({
        id: profile.id,
        name: childFullName,
        personId: childPerson.id,
      })
    }

    // OPTIMIZATION: Batch check and create enrollments (1 query + 1 createMany instead of N queries + N creates)
    if (profilesToCheckEnrollments.length > 0) {
      const profileIds = profilesToCheckEnrollments.map((p) => p.id)

      // Batch lookup existing active enrollments
      const existingEnrollments = await prisma.enrollment.findMany({
        where: {
          programProfileId: { in: profileIds },
          status: { in: ['REGISTERED', 'ENROLLED'] },
          endDate: null,
        },
        select: {
          programProfileId: true,
        },
      })

      const profilesWithEnrollments = new Set(
        existingEnrollments.map((e) => e.programProfileId)
      )

      // Batch create missing enrollments
      const enrollmentsToCreate = profilesToCheckEnrollments
        .filter((p) => !profilesWithEnrollments.has(p.id))
        .map((p) => ({
          programProfileId: p.id,
          batchId: null,
          status: 'REGISTERED' as EnrollmentStatus,
        }))

      if (enrollmentsToCreate.length > 0) {
        await prisma.enrollment.createMany({
          data: enrollmentsToCreate,
          skipDuplicates: true,
        })

        logger.info(
          {
            createdCount: enrollmentsToCreate.length,
            profileIds: enrollmentsToCreate.map((e) => e.programProfileId),
          },
          'Batch created missing enrollments'
        )
      }
    }

    createdProfiles.push(...childResults)

    // Phase 4: Batch create guardian relationships (idempotent with skipDuplicates)
    currentPhase = 'guardians'
    const guardianRelationships: Array<{
      guardianPersonId: string
      dependentPersonId: string
      role: GuardianRole
      isPrimaryPayer: boolean
    }> = []

    for (const profile of createdProfiles) {
      guardianRelationships.push({
        guardianPersonId: parent1Person.id,
        dependentPersonId: profile.personId,
        role: 'PARENT',
        isPrimaryPayer: resolvedPrimaryPayer === 'parent1',
      })

      if (parent2Person) {
        guardianRelationships.push({
          guardianPersonId: parent2Person.id,
          dependentPersonId: profile.personId,
          role: 'PARENT',
          isPrimaryPayer: resolvedPrimaryPayer === 'parent2',
        })
      }
    }

    await createGuardianRelationshipsBatch(guardianRelationships)

    // Log parent role additions
    for (const rel of guardianRelationships) {
      logger.info(
        {
          event: 'ROLE_ADDED',
          personId: rel.guardianPersonId,
          role: 'PARENT',
          dependentId: rel.dependentPersonId,
          program: 'DUGSI_PROGRAM',
          timestamp: new Date().toISOString(),
        },
        'Person became parent via Dugsi registration'
      )
    }

    // Phase 5: Create sibling relationships (batch with skipDuplicates)
    currentPhase = 'siblings'
    if (createdProfiles.length > 1) {
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

      // Batch fetch existing sibling relationships
      const existingRelationships = await prisma.siblingRelationship.findMany({
        where: {
          OR: siblingPairs.map(({ p1, p2 }) => ({
            person1Id: p1,
            person2Id: p2,
          })),
        },
      })

      const existingMap = new Map(
        existingRelationships.map((r) => [`${r.person1Id}-${r.person2Id}`, r])
      )

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

      if (toCreate.length > 0) {
        await prisma.siblingRelationship.createMany({
          data: toCreate,
          skipDuplicates: true,
        })
      }

      if (toReactivate.length > 0) {
        await prisma.siblingRelationship.updateMany({
          where: { id: { in: toReactivate } },
          data: {
            isActive: true,
            detectionMethod: 'manual',
          },
        })
      }
    }

    logger.info(
      {
        familyReferenceId,
        profileCount: createdProfiles.length,
        billingAccountId: billingAccount.id,
      },
      'Family registration completed successfully'
    )

    return {
      profiles: createdProfiles,
      billingAccount: {
        id: billingAccount.id,
        primaryContactPointId: billingAccount.primaryContactPointId,
      },
    }
  } catch (error) {
    // Log partial failure state for manual recovery
    logger.error(
      {
        familyReferenceId,
        phase: currentPhase,
        createdProfileCount: createdProfiles.length,
        createdProfileIds: createdProfiles.map((p) => p.id),
        error,
      },
      'Family registration failed - partial state may exist. Re-run registration to complete.'
    )
    throw error
  }
}

/**
 * Helper function to determine if a new name is more complete than the old name
 * Returns true if the new name should replace the old name
 */
function isNameMoreComplete(oldName: string, newName: string): boolean {
  const oldWords = oldName.trim().split(/\s+/)
  const newWords = newName.trim().split(/\s+/)

  // More words = more complete
  if (newWords.length > oldWords.length) return true

  // Check for initial expansion (J. → John)
  if (newWords.length === oldWords.length) {
    for (let i = 0; i < oldWords.length; i++) {
      const oldWord = oldWords[i]
      const newWord = newWords[i]

      // Old is initial (1-2 chars with period), new is full word
      if (oldWord.length <= 2 && oldWord.includes('.') && newWord.length > 2) {
        return true
      }
    }
  }

  return false
}

/**
 * Find or create a Person with contact points
 * Reuses existing Person if found by email/phone, otherwise creates new one
 */
export async function findOrCreatePersonWithContact(
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
      // Found existing person - update name if more complete and add missing contact points
      const shouldUpdateName = isNameMoreComplete(existingPerson.name, name)
      if (shouldUpdateName) {
        await client.person.update({
          where: { id: existingPerson.id },
          data: { name },
        })
        logger.info(
          {
            personId: existingPerson.id,
            oldName: existingPerson.name,
            newName: name,
          },
          'Updated person name to more complete version'
        )
      }

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
        // Clear existing primary flags for types we're adding as primary
        // This ensures only one contact point per type is marked as primary
        const primaryEmailBeingAdded = contactPointsToCreate.some(
          (cp) => cp.type === 'EMAIL' && cp.isPrimary
        )
        const primaryPhoneBeingAdded = contactPointsToCreate.some(
          (cp) => cp.type === 'PHONE' && cp.isPrimary
        )

        if (primaryEmailBeingAdded) {
          await client.contactPoint.updateMany({
            where: {
              personId: existingPerson.id,
              type: 'EMAIL',
              isPrimary: true,
            },
            data: { isPrimary: false },
          })
        }
        if (primaryPhoneBeingAdded) {
          await client.contactPoint.updateMany({
            where: {
              personId: existingPerson.id,
              type: 'PHONE',
              isPrimary: true,
            },
            data: { isPrimary: false },
          })
        }

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

      if (!updatedPerson) {
        throw new Error('Failed to update person with contact points')
      }

      return updatedPerson
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
 * Batch lookup existing children by name and DOB
 * Reduces N individual queries to 1 query with OR conditions
 *
 * Optimization for Phase 3 of family registration to prevent connection pool exhaustion
 */
export async function findExistingChildren(
  children: Array<{
    firstName: string
    lastName: string
    dateOfBirth?: Date | null | undefined
  }>
): Promise<Map<string, { id: string; name: string }>> {
  const childrenWithDob = children.filter(
    (c): c is { firstName: string; lastName: string; dateOfBirth: Date } =>
      c.dateOfBirth instanceof Date
  )

  if (childrenWithDob.length === 0) {
    return new Map()
  }

  const whereConditions = childrenWithDob.map((child) => {
    // Normalize whitespace consistently with getChildLookupKey()
    const normalizedName = `${child.firstName} ${child.lastName}`
      .trim()
      .replace(/\s+/g, ' ')
    return {
      name: {
        equals: normalizedName,
        mode: 'insensitive' as const,
      },
      dateOfBirth: {
        equals: child.dateOfBirth!,
      },
    }
  })

  const existingPeople = await prisma.person.findMany({
    where: { OR: whereConditions },
    select: { id: true, name: true, dateOfBirth: true },
  })

  const map = new Map<string, { id: string; name: string }>()
  for (const person of existingPeople) {
    const key = getChildLookupKey(person.name, person.dateOfBirth)
    map.set(key, { id: person.id, name: person.name })
  }

  return map
}

/**
 * Batch lookup existing Dugsi profiles for children
 * Reduces N individual queries to 1 query
 *
 * Note: This function is Dugsi-specific (hardcoded DUGSI_PROGRAM filter).
 * For other programs, create a program-specific variant or a generic function with a program parameter.
 *
 * Optimization for Phase 3 of family registration to prevent connection pool exhaustion
 */
export async function findExistingDugsiProfiles(
  personIds: string[]
): Promise<
  Map<
    string,
    Awaited<ReturnType<typeof prisma.programProfile.findMany>>[number]
  >
> {
  if (personIds.length === 0) {
    return new Map()
  }

  const profiles = await prisma.programProfile.findMany({
    where: {
      personId: { in: personIds },
      program: 'DUGSI_PROGRAM',
    },
  })

  const map = new Map<string, (typeof profiles)[0]>()
  for (const profile of profiles) {
    map.set(profile.personId, profile)
  }

  return map
}

/**
 * Find existing child Person by name and date of birth
 */
async function findExistingChild(
  firstName: string,
  lastName: string,
  dateOfBirth: Date | null | undefined
): Promise<{ id: string; name: string } | null> {
  const fullName = `${firstName} ${lastName}`.trim()

  if (!dateOfBirth) {
    return null
  }

  // Find person by name and DOB
  const existing = await prisma.person.findFirst({
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
 * Pre-flight validation to catch family conflicts before any writes.
 * This prevents orphaned data when a child is already registered
 * under a different family.
 *
 * OPTIMIZATION: Uses batched lookups instead of per-child queries
 */
async function validateFamilyConflicts(
  children: Array<z.infer<typeof childDataSchema>>,
  familyReferenceId: string
): Promise<void> {
  // Batch lookup all existing children (1 query instead of N)
  const existingChildrenMap = await findExistingChildren(children)

  if (existingChildrenMap.size === 0) {
    // No existing children, no conflicts possible
    return
  }

  // Batch lookup profiles for all existing children (1 query instead of N)
  const existingPersonIds = Array.from(existingChildrenMap.values()).map(
    (p) => p.id
  )
  const existingProfilesMap = await findExistingDugsiProfiles(existingPersonIds)

  // Check for conflicts using the maps
  for (const child of children) {
    const childFullName = `${child.firstName} ${child.lastName}`
    const lookupKey = getChildLookupKey(childFullName, child.dateOfBirth)

    const existingChild = existingChildrenMap.get(lookupKey)
    if (existingChild) {
      const profile = existingProfilesMap.get(existingChild.id)

      if (
        profile?.familyReferenceId &&
        profile.familyReferenceId !== familyReferenceId
      ) {
        throw new Error(
          `Child ${child.firstName} ${child.lastName} is already registered ` +
            `under a different family. Contact support to update family relationships.`
        )
      }
    }
  }
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

  // Ensure only one guardian can be isPrimaryPayer per dependent
  // Clear other isPrimaryPayer flags before setting new one
  if (isPrimaryPayer) {
    await client.guardianRelationship.updateMany({
      where: {
        dependentId: dependentPersonId,
        guardianId: { not: guardianPersonId },
        isActive: true,
        isPrimaryPayer: true,
      },
      data: { isPrimaryPayer: false },
    })
  }

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

  // Validate before creating (pass tx for transaction visibility)
  await validateGuardianRelationship(
    {
      guardianId: guardianPersonId,
      dependentId: dependentPersonId,
      role,
    },
    tx
  )

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

/**
 * Batch create guardian relationships for multiple children
 * Optimizes by doing single batch queries instead of per-child operations
 *
 * @internal Exported for testing purposes
 */
export async function createGuardianRelationshipsBatch(
  relationships: Array<{
    guardianPersonId: string
    dependentPersonId: string
    role: GuardianRole
    isPrimaryPayer: boolean
  }>,
  tx?: Prisma.TransactionClient
) {
  if (relationships.length === 0) return

  const client = tx || prisma
  const dependentIds = Array.from(
    new Set(relationships.map((r) => r.dependentPersonId))
  )

  // 1. Batch fetch existing relationships (1 query instead of N)
  const existingRelationships = await client.guardianRelationship.findMany({
    where: {
      OR: relationships.map((r) => ({
        guardianId: r.guardianPersonId,
        dependentId: r.dependentPersonId,
      })),
    },
  })

  const existingMap = new Map(
    existingRelationships.map((r) => [`${r.guardianId}-${r.dependentId}`, r])
  )

  // 2. Separate into create vs update
  const toCreate: Array<{
    guardianId: string
    dependentId: string
    role: GuardianRole
    isPrimaryPayer: boolean
    isActive: boolean
  }> = []
  const toReactivate: string[] = []

  for (const rel of relationships) {
    const key = `${rel.guardianPersonId}-${rel.dependentPersonId}`
    const existing = existingMap.get(key)

    if (!existing) {
      toCreate.push({
        guardianId: rel.guardianPersonId,
        dependentId: rel.dependentPersonId,
        role: rel.role,
        isPrimaryPayer: rel.isPrimaryPayer,
        isActive: true,
      })
    } else if (!existing.isActive) {
      toReactivate.push(existing.id)
    }
  }

  // 3. Clear isPrimaryPayer for OTHER guardians (1 updateMany instead of N)
  const primaryPayerGuardianIds = relationships
    .filter((r) => r.isPrimaryPayer)
    .map((r) => r.guardianPersonId)

  if (primaryPayerGuardianIds.length > 0) {
    await client.guardianRelationship.updateMany({
      where: {
        dependentId: { in: dependentIds },
        guardianId: { notIn: primaryPayerGuardianIds },
        isActive: true,
        isPrimaryPayer: true,
      },
      data: { isPrimaryPayer: false },
    })
  }

  // 4. Batch create new relationships
  if (toCreate.length > 0) {
    try {
      const result = await client.guardianRelationship.createMany({
        data: toCreate,
        skipDuplicates: true,
      })

      if (result.count !== toCreate.length) {
        logger.warn(
          {
            expected: toCreate.length,
            created: result.count,
            skipped: toCreate.length - result.count,
          },
          'Some guardian relationships already existed (race condition detected)'
        )
      }
    } catch (error) {
      logger.error(
        { error, toCreateCount: toCreate.length },
        'Failed to create guardian relationships'
      )
      throw error
    }
  }

  // 5. Batch reactivate inactive relationships
  if (toReactivate.length > 0) {
    await client.guardianRelationship.updateMany({
      where: { id: { in: toReactivate } },
      data: { isActive: true },
    })
  }
}
