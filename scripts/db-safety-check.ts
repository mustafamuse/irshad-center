// ⚠️ CRITICAL MIGRATION NEEDED: This file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model

/**
 * Database Safety Check
 *
 * This script MUST be run before any destructive database operations.
 * It validates the environment and prevents accidental production database operations.
 *
 * Usage:
 *   import { validateDatabaseEnvironment, DatabaseEnvironment } from './db-safety-check'
 *   const env = await validateDatabaseEnvironment()
 *   if (env === 'PRODUCTION') {
 *     throw new Error('Cannot run destructive operations on production!')
 *   }
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type DatabaseEnvironment =
  | 'PRODUCTION'
  | 'STAGING'
  | 'DEVELOPMENT'
  | 'UNKNOWN'

interface EnvironmentCheck {
  environment: DatabaseEnvironment
  databaseUrl: string
  projectName: string | null
  isSafe: boolean
  warnings: string[]
  errors: string[]
}

/**
 * Detects the database environment based on URL patterns and environment variables
 */
export function detectEnvironmentFromUrl(
  databaseUrl: string
): DatabaseEnvironment {
  const url = databaseUrl.toLowerCase()

  // Check for explicit staging indicators
  if (
    url.includes('staging') ||
    url.includes('stage') ||
    url.includes('test')
  ) {
    return 'STAGING'
  }

  // Check for development/local indicators (treat as staging for safety)
  if (
    url.includes('dev') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1')
  ) {
    return 'DEVELOPMENT'
  }

  // Check for production indicators
  // NOTE: .env.local is PRODUCTION (main database)
  // If URL doesn't explicitly say staging/dev, assume PRODUCTION
  if (
    url.includes('production') ||
    url.includes('prod') ||
    url.includes('irshad-center') ||
    url.includes('supabase') // Supabase URLs are production unless explicitly staging
  ) {
    return 'PRODUCTION'
  }

  // Check environment variables
  const nodeEnv = process.env.NODE_ENV?.toLowerCase()
  if (nodeEnv === 'production') {
    return 'PRODUCTION'
  }
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return 'DEVELOPMENT'
  }

  return 'UNKNOWN'
}

/**
 * Validates the database environment and returns safety status
 */
export async function validateDatabaseEnvironment(): Promise<EnvironmentCheck> {
  const databaseUrl = process.env.DATABASE_URL || ''
  const warnings: string[] = []
  const errors: string[] = []

  // Check if DATABASE_URL is set
  if (!databaseUrl) {
    errors.push('DATABASE_URL environment variable is not set')
    return {
      environment: 'UNKNOWN',
      databaseUrl: '',
      projectName: null,
      isSafe: false,
      warnings,
      errors,
    }
  }

  // Detect environment
  const detectedEnv = detectEnvironmentFromUrl(databaseUrl)

  // Check for explicit environment markers
  const explicitEnv = process.env.DATABASE_ENV || process.env.ENVIRONMENT
  let finalEnvironment: DatabaseEnvironment = detectedEnv

  if (explicitEnv) {
    const explicit = explicitEnv.toUpperCase()
    if (explicit === 'PRODUCTION' || explicit === 'PROD') {
      finalEnvironment = 'PRODUCTION'
    } else if (explicit === 'STAGING' || explicit === 'STAGE') {
      finalEnvironment = 'STAGING'
    } else if (explicit === 'DEVELOPMENT' || explicit === 'DEV') {
      finalEnvironment = 'DEVELOPMENT'
    }
  }

  // Check database for project identification
  let projectName: string | null = null
  try {
    // Try to get project info from Supabase project ref if available
    const projectRef =
      process.env.SUPABASE_PROJECT_REF ||
      process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF
    if (projectRef) {
      projectName = `supabase-${projectRef}`
    }

    // Check if database has data
    // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
    const studentCount = 0 // Temporary: return 0 until migration complete
    // const studentCount = await prisma.student.count().catch(() => 0)

    // If significant data exists and environment is not explicitly set, warn
    if (studentCount > 100) {
      if (finalEnvironment === 'UNKNOWN' || finalEnvironment === 'STAGING') {
        warnings.push(
          `Database contains ${studentCount} students - this appears to be PRODUCTION`
        )
        warnings.push('⚠️  If this is production, set DATABASE_ENV=PRODUCTION')
        if (finalEnvironment === 'UNKNOWN') {
          errors.push(
            'Database contains significant data but environment is UNKNOWN - set DATABASE_ENV explicitly'
          )
        }
      }
    }

    // If using .env.local (which is production), ensure it's marked as PRODUCTION
    if (
      process.env.NODE_ENV !== 'production' &&
      studentCount > 50 &&
      !explicitEnv
    ) {
      warnings.push(
        '⚠️  Using .env.local with data - ensure DATABASE_ENV=PRODUCTION is set'
      )
    }
  } catch (error) {
    warnings.push('Could not verify database contents')
  }

  // Safety checks
  const isSafe = finalEnvironment !== 'PRODUCTION' && errors.length === 0

  if (finalEnvironment === 'PRODUCTION') {
    errors.push(
      '⚠️ PRODUCTION DATABASE DETECTED - Destructive operations are BLOCKED'
    )
  }

  if (finalEnvironment === 'UNKNOWN') {
    warnings.push(
      '⚠️ Could not determine database environment - proceeding with caution'
    )
    errors.push(
      'Environment is UNKNOWN - cannot proceed with destructive operations'
    )
  }

  // Check for safety override (should only be used in emergencies)
  if (process.env.ALLOW_PRODUCTION_OPERATIONS === 'true') {
    errors.push(
      '⚠️ PRODUCTION OPERATIONS OVERRIDE IS ENABLED - This is DANGEROUS'
    )
  }

  return {
    environment: finalEnvironment,
    databaseUrl: maskDatabaseUrl(databaseUrl),
    projectName,
    isSafe,
    warnings,
    errors,
  }
}

/**
 * Masks sensitive parts of database URL for logging
 */
function maskDatabaseUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    if (urlObj.password) {
      urlObj.password = '***'
    }
    return urlObj.toString()
  } catch {
    // If URL parsing fails, mask password pattern
    return url.replace(/:([^:@]+)@/, ':***@')
  }
}

/**
 * Blocks destructive operations on production databases
 */
export async function requireNonProductionEnvironment(
  operation: string
): Promise<void> {
  const check = await validateDatabaseEnvironment()

  console.log('\n' + '='.repeat(80))
  console.log(`🔒 SAFETY CHECK: ${operation}`)
  console.log('='.repeat(80))
  console.log(`Environment: ${check.environment}`)
  console.log(`Database: ${check.databaseUrl}`)
  if (check.projectName) {
    console.log(`Project: ${check.projectName}`)
  }

  if (check.warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    check.warnings.forEach((warning) => console.log(`   ${warning}`))
  }

  if (check.errors.length > 0) {
    console.log('\n❌ ERRORS:')
    check.errors.forEach((error) => console.log(`   ${error}`))
  }

  console.log('='.repeat(80) + '\n')

  if (!check.isSafe) {
    throw new Error(
      `❌ SAFETY CHECK FAILED: Cannot perform "${operation}" on ${check.environment} database.\n` +
        `Errors: ${check.errors.join('; ')}\n` +
        `\nTo proceed, you must:\n` +
        `1. Verify this is NOT production\n` +
        `2. Set DATABASE_ENV=STAGING or DATABASE_ENV=DEVELOPMENT\n` +
        `3. Or ensure DATABASE_URL contains 'staging' or 'dev'\n` +
        `\nNEVER set ALLOW_PRODUCTION_OPERATIONS=true unless absolutely necessary!`
    )
  }

  if (check.environment === 'UNKNOWN') {
    throw new Error(
      `❌ SAFETY CHECK FAILED: Cannot determine database environment.\n` +
        `Please set DATABASE_ENV environment variable (STAGING, DEVELOPMENT, or PRODUCTION)`
    )
  }
}

// Run check if called directly
if (require.main === module) {
  validateDatabaseEnvironment()
    .then((check) => {
      console.log('\n📊 Database Environment Check Results:')
      console.log(JSON.stringify(check, null, 2))
      process.exit(check.isSafe ? 0 : 1)
    })
    .catch((error) => {
      console.error('❌ Safety check failed:', error)
      process.exit(1)
    })
    .finally(() => {
      prisma.$disconnect()
    })
}
