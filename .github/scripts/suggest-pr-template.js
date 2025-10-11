#!/usr/bin/env node

/**
 * AI-powered PR Template Suggester
 * Analyzes your branch name and changes to suggest the right PR template
 *
 * Usage:
 * - Run manually: node .github/scripts/suggest-pr-template.js
 * - Integrated with git hooks (see .github/README.md)
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
    }).trim()
  } catch (error) {
    return null
  }
}

function getChangedFiles() {
  try {
    // Get files changed compared to main/master
    const baseBranch =
      execSync(
        'git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed "s@^refs/remotes/origin/@@"',
        { encoding: 'utf-8' }
      ).trim() || 'main'

    return execSync(`git diff --name-only ${baseBranch}...HEAD`, {
      encoding: 'utf-8',
    })
      .split('\n')
      .filter((f) => f.trim())
  } catch (error) {
    // Fallback to staged files
    try {
      return execSync('git diff --cached --name-only', { encoding: 'utf-8' })
        .split('\n')
        .filter((f) => f.trim())
    } catch (e) {
      return []
    }
  }
}

function analyzeChanges(branchName, changedFiles) {
  const branch = (branchName || '').toLowerCase()
  const filesStr = changedFiles.join(' ').toLowerCase()

  let template = 'default'
  let templateFile = 'PULL_REQUEST_TEMPLATE.md'
  let reason = ''
  let priority = 0
  let emoji = '📝'

  // Calculate database-related changes
  const dbFiles = changedFiles.filter(
    (f) =>
      f.includes('prisma/schema.prisma') ||
      f.includes('prisma/migrations') ||
      f.includes('prisma/seed')
  )
  const totalFiles = changedFiles.length
  const dbPercentage = totalFiles > 0 ? (dbFiles.length / totalFiles) * 100 : 0

  // Priority 1: Database changes (CRITICAL)
  // Only trigger if:
  // - Branch explicitly named migration/database, OR
  // - Database files are >50% of changes (focused migration), OR
  // - Only database files changed
  if (
    branch.startsWith('migration/') ||
    branch.startsWith('database/') ||
    branch.startsWith('schema/') ||
    (dbFiles.length > 0 && totalFiles <= 3) || // Small PR with DB changes
    dbPercentage > 50 // Majority of changes are DB-related
  ) {
    template = 'database_migration'
    templateFile = 'PULL_REQUEST_TEMPLATE/database_migration.md'
    reason = branch.startsWith('migration/')
      ? 'Migration branch detected'
      : `Database-focused changes (${dbFiles.length}/${totalFiles} files)`
    priority = 10
    emoji = '🗃️'
  }

  // Priority 2: Hotfix (URGENT)
  else if (
    branch.startsWith('hotfix/') ||
    branch.startsWith('emergency/') ||
    branch.includes('urgent') ||
    branch.includes('critical')
  ) {
    template = 'hotfix'
    templateFile = 'PULL_REQUEST_TEMPLATE/hotfix.md'
    reason = 'Hotfix/urgent branch detected'
    priority = 9
    emoji = '🔥'
  }

  // Priority 3: Bug fix
  else if (
    branch.startsWith('fix/') ||
    branch.startsWith('bugfix/') ||
    branch.startsWith('bug/')
  ) {
    template = 'bug_fix'
    templateFile = 'PULL_REQUEST_TEMPLATE/bug_fix.md'
    reason = 'Bug fix branch detected'
    priority = 5
    emoji = '🐛'
  }

  // Priority 4: Feature
  else if (branch.startsWith('feature/') || branch.startsWith('feat/')) {
    template = 'feature'
    templateFile = 'PULL_REQUEST_TEMPLATE/feature.md'
    reason = 'Feature branch detected'
    priority = 3
    emoji = '✨'
  }

  // Default
  else {
    reason = 'Using default template (no specific pattern matched)'
    priority = 1
    emoji = '📝'
  }

  return { template, templateFile, reason, priority, emoji }
}

function displaySuggestion(branchName, changedFiles, analysis) {
  log('\n' + '='.repeat(60), 'bright')
  log('🤖 AI PR Template Suggester', 'cyan')
  log('='.repeat(60), 'bright')

  log('\n📊 Analysis:', 'yellow')
  log(`  Branch: ${branchName}`, 'blue')
  log(`  Changed files: ${changedFiles.length}`, 'blue')

  if (changedFiles.some((f) => f.includes('prisma'))) {
    log('  ⚠️  PRISMA SCHEMA CHANGES DETECTED!', 'red')
  }

  log(
    `\n${analysis.emoji} Recommended Template: ${analysis.template.toUpperCase()}`,
    'green'
  )
  log(`  Reason: ${analysis.reason}`, 'cyan')
  log(`  Template file: .github/${analysis.templateFile}`, 'magenta')

  log('\n📋 What to do next:', 'yellow')
  log('  1. Create your PR on GitHub', 'blue')
  log('  2. The GitHub Action will automatically apply this template', 'blue')
  log('  3. Fill out the template checklist', 'blue')
  log('  4. Request review when ready', 'blue')

  if (analysis.template === 'database_migration') {
    log('\n⚠️  CRITICAL REMINDER:', 'red')
    log('  - NEVER reset the database', 'red')
    log('  - Schema changes must be ADDITIVE ONLY', 'red')
    log('  - Review /docs/CRITICAL_RULES.md', 'red')
  } else if (changedFiles.some((f) => f.includes('prisma'))) {
    // Warn about DB changes even if not using migration template
    log('\n⚠️  Database changes detected in this PR:', 'yellow')
    log('  - Remember: Schema changes must be ADDITIVE ONLY', 'yellow')
    log('  - See /docs/CRITICAL_RULES.md for safety rules', 'yellow')
    const dbFilesList = changedFiles.filter((f) => f.includes('prisma'))
    log(`  - Changed files: ${dbFilesList.join(', ')}`, 'yellow')
  }

  log('\n💡 Branch Naming Tips:', 'yellow')
  log('  - feature/* → Feature template', 'blue')
  log('  - fix/* or bugfix/* → Bug fix template', 'blue')
  log('  - hotfix/* → Hotfix template', 'blue')
  log('  - migration/* or database/* → Database migration template', 'blue')

  log('\n' + '='.repeat(60) + '\n', 'bright')
}

function main() {
  const branchName = getCurrentBranch()
  const changedFiles = getChangedFiles()

  if (!branchName) {
    log('❌ Could not detect current branch', 'red')
    process.exit(1)
  }

  const analysis = analyzeChanges(branchName, changedFiles)
  displaySuggestion(branchName, changedFiles, analysis)

  // Return exit code based on priority (for use in CI/CD)
  process.exit(0)
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { analyzeChanges, getCurrentBranch, getChangedFiles }
