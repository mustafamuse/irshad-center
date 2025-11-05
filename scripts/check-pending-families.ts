/**
 * Check Pending Families - READ ONLY
 *
 * This script finds families that qualify for bank verification but are missing PaymentIntent IDs.
 * NO DATABASE CHANGES - just displays information.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPendingFamilies() {
  console.log('🔍 Checking for pending families needing PaymentIntent IDs...\n')
  console.log('='.repeat(80))

  try {
    // Find all students with payment captured but missing PaymentIntent ID
    const students = await prisma.student.findMany({
      where: {
        program: 'DUGSI_PROGRAM',
        paymentMethodCaptured: true,
        stripeCustomerIdDugsi: { not: null },
        paymentIntentIdDugsi: null, // Missing PaymentIntent ID
        // Also include those with incomplete subscriptions (not active)
        OR: [
          { subscriptionStatus: null },
          { subscriptionStatus: { not: 'active' } },
        ],
      },
      select: {
        id: true,
        name: true,
        familyReferenceId: true,
        stripeCustomerIdDugsi: true,
        stripeSubscriptionIdDugsi: true,
        subscriptionStatus: true,
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: true,
        parentEmail: true,
        parentFirstName: true,
        parentLastName: true,
      },
      orderBy: {
        familyReferenceId: 'asc',
      },
    })

    if (students.length === 0) {
      console.log('✅ No families found needing PaymentIntent IDs!')
      console.log(
        '   All pending families already have PaymentIntent IDs populated.'
      )
      return
    }

    // Group by family
    const familiesMap = new Map<string, typeof students>()
    students.forEach((student) => {
      const familyKey =
        student.familyReferenceId || student.stripeCustomerIdDugsi || student.id
      if (!familiesMap.has(familyKey)) {
        familiesMap.set(familyKey, [])
      }
      familiesMap.get(familyKey)!.push(student)
    })

    const families = Array.from(familiesMap.values())

    console.log(`\n📊 SUMMARY`)
    console.log('='.repeat(80))
    console.log(`Total families needing PaymentIntent IDs: ${families.length}`)
    console.log(`Total students affected: ${students.length}`)
    console.log()

    console.log(`\n📋 DETAILED LIST`)
    console.log('='.repeat(80))

    families.forEach((familyMembers, index) => {
      const firstMember = familyMembers[0]
      const hasActiveSubscription = familyMembers.some(
        (s) => s.stripeSubscriptionIdDugsi && s.subscriptionStatus === 'active'
      )
      const status = hasActiveSubscription
        ? '✅ HAS ACTIVE SUBSCRIPTION'
        : '⏳ PENDING SETUP'

      console.log(
        `\nFamily ${index + 1}/${families.length}: ${firstMember.familyReferenceId || 'No Family ID'}`
      )
      console.log(`  Status: ${status}`)
      console.log(`  Customer ID: ${firstMember.stripeCustomerIdDugsi}`)
      console.log(`  Parent Email: ${firstMember.parentEmail || 'N/A'}`)
      console.log(
        `  Parent Name: ${firstMember.parentFirstName || ''} ${firstMember.parentLastName || ''}`.trim() ||
          'N/A'
      )
      console.log(
        `  Payment Captured: ${firstMember.paymentMethodCapturedAt?.toLocaleDateString() || 'N/A'}`
      )
      console.log(`  Students (${familyMembers.length}):`)
      familyMembers.forEach((student) => {
        console.log(`    - ${student.name} (ID: ${student.id})`)
      })
      console.log(`  ⚠️  Missing: paymentIntentIdDugsi`)
    })

    console.log('\n' + '='.repeat(80))
    console.log(`\n💡 NEXT STEPS:`)
    console.log(`   - Review the list above`)
    console.log(
      `   - These families have payment captured but missing PaymentIntent IDs`
    )
    console.log(
      `   - Without PaymentIntent IDs, the "Verify Bank Account" button won't appear`
    )
    console.log(
      `   - You can backfill these manually in Prisma Studio or create a backfill script`
    )
    console.log()
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the check
checkPendingFamilies()
  .then(() => {
    console.log('✅ Check complete!\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
