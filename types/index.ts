/**
 * Type Exports for Irshad Center Platform
 *
 * ✅ MIGRATION COMPLETE:
 * Student model has been replaced with the unified identity system:
 * Person → ProgramProfile → Enrollment
 */

// Export all types from the new unified model
export * from './models'

// Utility types
export type SearchParams = {
  [key: string]: string | string[] | undefined
}
