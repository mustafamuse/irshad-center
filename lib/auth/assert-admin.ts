import { cookies } from 'next/headers'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createActionLogger } from '@/lib/logger'

import { verifyAuthToken } from './admin-auth'

const logger = createActionLogger('assert-admin')

export async function assertAdmin(caller?: string): Promise<void> {
  const log = caller ? logger.child({ caller }) : logger

  const cookieStore = await cookies()
  const token = cookieStore.get('admin_auth')?.value

  if (!token) {
    log.warn('Admin auth check failed: no token cookie')
    throw new ActionError(
      'Unauthorized',
      ERROR_CODES.UNAUTHORIZED,
      undefined,
      401
    )
  }

  if (!verifyAuthToken(token)) {
    log.warn('Admin auth check failed: token verification failed')
    throw new ActionError(
      'Unauthorized',
      ERROR_CODES.UNAUTHORIZED,
      undefined,
      401
    )
  }
}
