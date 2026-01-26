import * as Sentry from '@sentry/nextjs'

export function setSentryUser(user: {
  id: string
  email?: string
  username?: string
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  })
}

export function clearSentryUser() {
  Sentry.setUser(null)
}

export function setSentryContext(
  name: string,
  context: Record<string, unknown>
) {
  Sentry.setContext(name, context)
}

export function addSentryBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  })
}
