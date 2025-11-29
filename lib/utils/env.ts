/**
 * Environment Variable Utilities
 *
 * Type-safe access to environment variables with validation.
 * Centralizes environment variable handling for consistency.
 */

/**
 * Get and validate the application URL from environment.
 *
 * @throws Error if NEXT_PUBLIC_APP_URL is not configured or malformed
 * @returns Validated app URL (without trailing slash)
 */
export function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL environment variable is not configured'
    )
  }
  if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
    throw new Error('NEXT_PUBLIC_APP_URL must start with http:// or https://')
  }
  return appUrl.replace(/\/$/, '')
}

/**
 * Check if running in production environment.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if running in development environment.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}
