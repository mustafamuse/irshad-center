/**
 * Duplicate Detection Service
 *
 * Centralized service for checking duplicate registrations across all programs.
 * This eliminates the need for separate checkEmailExists/checkPhoneExists functions
 * and provides a single source of truth for duplicate detection logic.
 */

import { Program } from '@prisma/client'

import { prisma } from '@/lib/db'
import { findPersonByContact } from '@/lib/db/queries/program-profile'
import type { DatabaseClient } from '@/lib/db/types'
import { createClientLogger } from '@/lib/logger-client'
import type { DuplicateField } from '@/lib/types/registration-errors'
import { normalizePhone } from '@/lib/utils/contact-normalization'

const logger = createClientLogger('DuplicateDetectionService')

/**
 * Result of a duplicate detection check
 */
export interface DuplicateCheckResult {
  /** Whether a duplicate was found */
  isDuplicate: boolean

  /** Which contact field caused the duplicate (null if no duplicate) */
  duplicateField: DuplicateField | null

  /** The existing person found (null if no duplicate) */
  existingPerson: Awaited<ReturnType<typeof findPersonByContact>>

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
   * // Check for Mahad duplicate
   * const result = await DuplicateDetectionService.checkDuplicate({
   *   email: 'test@example.com',
   *   phone: '+1234567890',
   *   program: 'MAHAD_PROGRAM'
   * })
   *
   * if (result.isDuplicate && result.hasActiveProfile) {
   *   // Handle duplicate registration error
   *   console.log(`Duplicate ${result.duplicateField} found`)
   * }
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

    logger.info('Checking for duplicate registration', {
      email,
      phone,
      program,
    })

    try {
      // Find person by email or phone
      const existingPerson = await findPersonByContact(email, phone, client)

      // No person found - not a duplicate
      if (!existingPerson) {
        logger.info('No existing person found', { email, phone })
        return {
          isDuplicate: false,
          duplicateField: null,
          existingPerson: null,
          hasActiveProfile: false,
        }
      }

      logger.info('Found existing person', {
        personId: existingPerson.id,
        email,
        phone,
      })

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

      logger.info('Duplicate check complete', {
        isDuplicate: true,
        duplicateField,
        hasActiveProfile,
        profileId: activeProfile?.id,
      })

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
      logger.error('Duplicate check failed', {
        err: error,
        email,
        phone,
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
    person: NonNullable<Awaited<ReturnType<typeof findPersonByContact>>>,
    submittedEmail?: string | null,
    submittedPhone?: string | null
  ): DuplicateField {
    const contactPoints = person.contactPoints

    // Check if submitted email matches any email contact point
    const emailMatches = submittedEmail
      ? contactPoints.some(
          (cp) =>
            cp.type === 'EMAIL' &&
            cp.value.toLowerCase() === submittedEmail.toLowerCase().trim()
        )
      : false

    // Check if submitted phone matches any phone/whatsapp contact point
    // Note: Phone numbers are stored normalized (digits only) in the database
    const phoneMatches = submittedPhone
      ? contactPoints.some(
          (cp) =>
            (cp.type === 'PHONE' || cp.type === 'WHATSAPP') &&
            cp.value === normalizePhone(submittedPhone)
        )
      : false

    // If both match, return 'both'
    if (emailMatches && phoneMatches) {
      return 'both'
    }

    // If only phone matches, return 'phone' (this was the bug - it was returning 'email')
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
