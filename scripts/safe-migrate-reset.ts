#!/usr/bin/env node
/**
 * Safe Migration Reset
 * 
 * This is a SAFE wrapper around prisma migrate reset that:
 * 1. Validates the environment is NOT production
 * 2. Creates a backup before resetting
 * 3. Requires explicit confirmation
 * 4. Logs all operations
 * 
 * Usage:
 *   npx tsx scripts/safe-migrate-reset.ts
 */

import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { requireNonProductionEnvironment } from './db-safety-check'
import { backupData } from '../lib/actions/backup-data'

async function safeMigrateReset() {
  console.log('🛡️  SAFE MIGRATION RESET\n')

  try {
    // Step 1: Safety check
    await requireNonProductionEnvironment('Database Reset')

    // Step 2: Create backup
    console.log('📦 Creating backup before reset...')
    const backupResult = await backupData()
    
    if (!backupResult.success) {
      throw new Error(`Backup failed: ${backupResult.error}`)
    }

    console.log(`✅ Backup created: ${backupResult.fileName}`)
    console.log(`   Students: ${backupResult.stats?.students || 0}`)
    console.log(`   Batches: ${backupResult.stats?.batches || 0}`)

    // Step 3: Require explicit confirmation
    const args = process.argv.slice(2)
    if (!args.includes('--confirm')) {
      console.log('\n⚠️  SAFETY CHECK: This will DELETE ALL DATA')
      console.log('To proceed, run with --confirm flag:')
      console.log('  npx tsx scripts/safe-migrate-reset.ts --confirm\n')
      process.exit(1)
    }

    // Step 4: Perform reset
    console.log('\n🔄 Resetting database...')
    execSync('npx prisma migrate reset --force', {
      stdio: 'inherit',
      env: {
        ...process.env,
        // Ensure we don't accidentally allow production operations
        ALLOW_PRODUCTION_OPERATIONS: undefined,
      },
    })

    console.log('\n✅ Database reset complete!')
    console.log(`📦 Backup saved at: backups/${backupResult.fileName}`)
  } catch (error) {
    console.error('\n❌ Reset failed:', error)
    if (error instanceof Error && error.message.includes('SAFETY CHECK FAILED')) {
      console.error('\n🛡️  This operation was blocked for your safety.')
    }
    process.exit(1)
  }
}

safeMigrateReset()

