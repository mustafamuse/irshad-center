import { cookies } from 'next/headers'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'

import { verifyAuthToken } from './admin-auth'

export async function assertAdmin(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_auth')?.value

  if (!token || !verifyAuthToken(token)) {
    throw new ActionError(
      'Unauthorized',
      ERROR_CODES.UNAUTHORIZED,
      undefined,
      401
    )
  }
}
