/**
 * Duplicate Detection Service
 *
 * Centralized service for checking duplicate registrations across all programs.
 * This eliminates the need for separate checkEmailExists/checkPhoneExists functions
 * and provides a single source of truth for duplicate detection logic.
 *
 * ## TOCTOU Race Condition Warning
 *
 * This service checks for existing persons but does NOT create them. To prevent
 * Time-of-Check-Time-of-Use (TOCTOU) race conditions, callers MUST:
 *
 * 1. Pass the same transaction client to both checkDuplicate() and createPersonWithContact()
 * 2. Perform both operations within the same database transaction
 * 3. Rely on database unique constraints as the ultimate safeguard
 *
 * The database has unique constraints on Person(email) and Person(phone) which will
 * reject duplicate contact points even if a race condition occurs.
 *
 * @example
 * ```typescript
 * // CORRECT: Same transaction for check and create
 * await prisma.$transaction(async (tx) => {
 *   const result = await DuplicateDetectionService.checkDuplicate({ email, phone, program }, tx)
 *   if (!result.isDuplicate) {
 *     await createPersonWithContact({ name, email, phone }, tx)
 *   }
 * })
 *
 * // INCORRECT: Separate transactions (race condition possible!)
 * const result = await DuplicateDetectionService.checkDuplicate({ email, phone, program })
 * if (!result.isDuplicate) {
 *   await createPersonWithContact({ name, email, phone }) // Another thread could have created!
 * }
 * ```
 */

import { Program } from '@prisma/client'

import { prisma } from '@/lib/db'
import { findPersonByActiveContact } from '@/lib/db/queries/program-profile'
import type { DatabaseClient } from '@/lib/db/types'
import { createServiceLogger, logError } from '@/lib/logger'
import type { DuplicateField } from '@/lib/types/registration-errors'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'

const logger = createServiceLogger('duplicate-detection')

/**
 * Result of a duplicate detection check
 */
export interface DuplicateCheckResult {
  /** Whether a duplicate was found */
  isDuplicate: boolean

  /** Which contact field caused the duplicate (null if no duplicate) */
  duplicateField: DuplicateField | null

  /** The existing person found (null if no duplicate) */
  existingPerson: Awaited<ReturnType<typeof findPersonByActiveContact>>

  /** Whether the person has an active profile for the specified program */
  hasActiveProfile: boolean

  /** The active program profile (if exists) */
  activeProfile?: {
    id: string
    program: Program
    enrollmentCount: number
    createdAt: Date
  }
}

/**
 * Duplicate Detection Service
 */
export class DuplicateDetectionService {
  /**
   * Check if a person is already registered for a specific program
   *
   * This is the ONLY method needed for duplicate detection - it replaces:
   * - checkEmailExists()
   * - checkPhoneExists()
   * - Duplicate detection in registerStudent()
   *
   * @param params - Email, phone, and program to check
   * @param client - Optional database client (for transaction support)
   * @returns Detailed duplicate check result
   *
   * @example
   * // Check for Mahad duplicate (within a transaction to prevent TOCTOU)
   * await prisma.$transaction(async (tx) => {
   *   const result = await DuplicateDetectionService.checkDuplicate({
   *     email: 'test@example.com',
   *     phone: '+1234567890',
   *     program: 'MAHAD_PROGRAM'
   *   }, tx)
   *
   *   if (result.isDuplicate && result.hasActiveProfile) {
   *     // Handle duplicate registration error
   *     logger.warn({ duplicateField: result.duplicateField }, 'Duplicate found')
   *     throw new Error('Already registered for this program')
   *   }
   *
   *   // Safe to create - same transaction prevents race condition
   *   await createPersonWithContact({ name, email, phone }, tx)
   * })
   */
  static async checkDuplicate(
    params: {
      email?: string | null
      phone?: string | null
      program: Program
    },
    client: DatabaseClient = prisma
  ): Promise<DuplicateCheckResult> {
    const { email, phone, program } = params

    // If neither email nor phone provided, no duplicate possible
    if (!email && !phone) {
      return {
        isDuplicate: false,
        duplicateField: null,
        existingPerson: null,
        hasActiveProfile: false,
      }
    }

    logger.info({ program }, 'Checking for duplicate registration')

    try {
      // Find person by email or phone
      const existingPerson = await findPersonByActiveContact(
        email,
        phone,
        client
      )

      // No person found - not a duplicate
      if (!existingPerson) {
        logger.info('No existing person found')
        return {
          isDuplicate: false,
          duplicateField: null,
          existingPerson: null,
          hasActiveProfile: false,
        }
      }

      logger.info({ personId: existingPerson.id }, 'Found existing person')

      // Check if person has an active profile for the specified program
      const activeProfile = existingPerson.programProfiles.find(
        (profile) =>
          profile.program === program && profile.enrollments.length > 0
      )

      const hasActiveProfile = !!activeProfile

      // Determine which field caused the duplicate
      const duplicateField = this.determineDuplicateField(
        existingPerson,
        email,
        phone
      )

      logger.info(
        {
          isDuplicate: true,
          duplicateField,
          hasActiveProfile,
          profileId: activeProfile?.id,
        },
        'Duplicate check complete'
      )

      return {
        isDuplicate: true,
        duplicateField,
        existingPerson,
        hasActiveProfile,
        activeProfile: activeProfile
          ? {
              id: activeProfile.id,
              program: activeProfile.program,
              enrollmentCount: activeProfile.enrollments.length,
              createdAt: activeProfile.createdAt,
            }
          : undefined,
      }
    } catch (error) {
      await logError(logger, error, 'Duplicate check failed', {
        program,
      })
      throw error
    }
  }

  /**
   * Determine which contact field (email, phone, or both) caused the duplicate
   *
   * This solves the original bug where duplicate phone errors showed on the email field.
   *
   * @param person - The existing person found
   * @param submittedPhone - The phone being registered
   * @returns Which field caused the duplicate
   */
  private static determineDuplicateField(
    person: NonNullable<Awaited<ReturnType<typeof findPersonByActiveContact>>>,
    submittedEmail?: string | null,
    submittedPhone?: string | null
  ): DuplicateField {
    const emailMatches =
      submittedEmail && person.email
        ? person.email === normalizeEmail(submittedEmail)
        : false

    const phoneMatches =
      submittedPhone && person.phone
        ? person.phone === normalizePhone(submittedPhone)
        : false

    if (emailMatches && phoneMatches) {
      return 'both'
    }

    if (phoneMatches) {
      return 'phone'
    }

    return 'email'
  }

  /**
   * Convenience method to check if an email is already registered for a program
   *
   * @param email - Email to check
   * @param program - Program to check against
   * @param client - Optional database client
   * @returns true if email is registered with an active profile
   */
  static async isEmailRegistered(
    email: string,
    program: Program,
    client?: DatabaseClient
  ): Promise<boolean> {
    const result = await this.checkDuplicate({ email, program }, client)
    return result.isDuplicate && result.hasActiveProfile
  }

  /**
   * Convenience method to check if a phone is already registered for a program
   *
   * @param phone - Phone number to check
   * @param program - Program to check against
   * @param client - Optional database client
   * @returns true if phone is registered with an active profile
   */
  static async isPhoneRegistered(
    phone: string,
    program: Program,
    client?: DatabaseClient
  ): Promise<boolean> {
    const result = await this.checkDuplicate({ phone, program }, client)
    return result.isDuplicate && result.hasActiveProfile
  }
}
