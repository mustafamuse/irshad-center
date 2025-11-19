import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is not set')
}

// Singleton Resend client
export const resend = new Resend(process.env.RESEND_API_KEY)

// Email configuration
export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'Irshad Center <noreply@irshadcenter.com>',
  adminEmail: process.env.ADMIN_EMAIL || 'umpp101@gmail.com',
  replyTo: process.env.REPLY_TO_EMAIL,
} as const
