import { Prisma } from '@prisma/client'

/**
 * Formats a user-friendly error message for duplicate constraint violations
 */
export function formatDuplicateError(params: {
  constraintName: string
  name?: string
  email?: string
  phone?: string
}): {
  message: string
  field?: 'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
} {
  const { constraintName, name, email, phone } = params

  // Email duplicate
  if (constraintName.includes('email')) {
    return {
      message: `A student with email "${email}" is already registered`,
      field: 'email',
    }
  }

  // Phone duplicate (normalized)
  if (constraintName.includes('phone')) {
    return {
      message: `A student with phone number "${phone}" is already registered`,
      field: 'phone',
    }
  }

  // Name + DOB duplicate
  if (
    constraintName.includes('name') &&
    constraintName.includes('dateOfBirth')
  ) {
    return {
      message: `A student with the name "${name}" and same date of birth is already registered`,
      field: 'dateOfBirth',
    }
  }

  // Fallback
  return {
    message: 'This information is already registered',
  }
}

/**
 * Handles Prisma unique constraint errors and returns formatted error
 * Returns null if error is not a unique constraint violation
 */
export function handlePrismaUniqueError(
  error: unknown,
  data: {
    name?: string
    email?: string
    phone?: string
  }
): {
  message: string
  field?: 'email' | 'phone' | 'firstName' | 'lastName' | 'dateOfBirth'
} | null {
  // Check if this is a Prisma unique constraint error
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    // Get the constraint name from error metadata
    const target = error.meta?.target as string[] | undefined
    const constraintName = target?.join('_') || 'unknown'

    return formatDuplicateError({
      constraintName,
      name: data.name,
      email: data.email,
      phone: data.phone,
    })
  }

  return null
}
