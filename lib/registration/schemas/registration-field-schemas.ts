import { z } from 'zod'

/**
 * Feature flag to show/hide grade and school fields in registration forms.
 * Set NEXT_PUBLIC_SHOW_GRADE_SCHOOL=true in Vercel to re-enable these fields.
 */
export const SHOW_GRADE_SCHOOL =
  process.env.NEXT_PUBLIC_SHOW_GRADE_SCHOOL === 'true'

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be less than 50 characters')
  .regex(
    /^[\p{L}\s'-]+$/u,
    'Name can only contain letters, spaces, hyphens, and apostrophes'
  )

export const emailSchema = z
  .string()
  .trim()
  .email('Please enter a valid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(100, 'Email must be less than 100 characters')

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d{3}-\d{3}-\d{4}$/, 'Enter a valid phone number (XXX-XXX-XXXX)')

export const schoolNameSchema = z
  .string()
  .trim()
  .min(2, 'School name must be at least 2 characters')
  .max(100, 'School name must be less than 100 characters')
  .regex(
    /^[\p{L}\p{Nd}\s.'-]+$/u,
    'School name can only contain letters, numbers, spaces, hyphens, periods, and apostrophes'
  )
