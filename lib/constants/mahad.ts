/**
 * Mahad Program Constants
 *
 * Centralized constants for the Mahad program
 */

// Program Constants
export const MAHAD_PROGRAM = 'MAHAD_PROGRAM' as const
export const MAHAD_WEBHOOK_SOURCE = 'mahad' as const

// Default Values
/**
 * Default monthly tuition rate in USD dollars.
 * This is the standard Mahad program monthly tuition rate.
 * Value: $150/month
 *
 * @note Update this value when base tuition rate changes
 * @note Used as default in registration when no custom rate is specified
 */
export const DEFAULT_MONTHLY_RATE = 150 // $150 USD per month
