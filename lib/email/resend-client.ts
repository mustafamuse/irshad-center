import { Resend } from 'resend'

import { env } from '../env'

/**
 * Singleton Resend client
 * Uses validated environment variables from lib/env.ts
 */
export const resend = new Resend(env.RESEND_API_KEY)

/**
 * Email configuration with validated environment variables
 * Provides type-safe access to email settings
 */
export const EMAIL_CONFIG = {
  from: env.EMAIL_FROM,
  adminEmail: env.ADMIN_EMAIL,
  replyTo: env.REPLY_TO_EMAIL,
} as const
