// ⚠️ CRITICAL MIGRATION NEEDED: Student model has been removed
// TODO: Migrate to ProgramProfile/Enrollment model

import { Batch, StudentPayment } from '@prisma/client'

export type SearchParams = {
  [key: string]: string | string[] | undefined
}

// TODO: Student model removed - migrate to ProgramProfile/Enrollment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StudentWithDetails = any
