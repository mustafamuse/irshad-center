/**
 * Mahad Services
 *
 * Centralized exports for all Mahad business logic services.
 *
 * Services:
 * - Cohort: Batch/cohort management and student listing
 * - Student: Student profile creation and updates
 *
 * Note: Batch assignment, transfer, and enrollment operations live in lib/db/queries/batch.ts.
 */

export * from './cohort-service'
export * from './student-service'
