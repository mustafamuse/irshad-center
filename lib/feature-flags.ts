const isDevelopment = process.env.NODE_ENV === 'development'

export const featureFlags = {
  consolidatedAdminUI:
    process.env.NEXT_PUBLIC_CONSOLIDATED_ADMIN === 'true' ||
    (process.env.NEXT_PUBLIC_CONSOLIDATED_ADMIN !== 'false' && isDevelopment),
} as const

export function isFeatureEnabled(flag: keyof typeof featureFlags): boolean {
  return featureFlags[flag]
}
