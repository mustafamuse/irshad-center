'use server'

/**
 * Update Student Action
 *
 * IMPORTANT: This action needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

export async function updateStudent(
  _id: string,
  _data: Record<string, unknown>
) {
  console.error(
    '[UPDATE_STUDENT] updateStudent disabled during schema migration'
  )
  throw new Error('Student update needs migration to new schema.')
}
