import { cookies } from 'next/headers'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createActionLogger } from '@/lib/logger'

import { verifyAuthToken } from './admin-auth'

const logger = createActionLogger('assert-admin')

export async function assertAdmin(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_auth')?.value

  if (!token || !verifyAuthToken(token)) {
    logger.warn({ hasToken: !!token }, 'Admin auth check failed')
    throw new ActionError(
      'Unauthorized',
      ERROR_CODES.UNAUTHORIZED,
      undefined,
      401
    )
  }
}
