/**
 * Test script for verifying duplicate customer prevention logic
 * Updated for simplified schema where students manage their own Stripe customers
 *
 * Run with: npx ts-node scripts/test-duplicate-prevention.ts
 */

import { prisma } from '../lib/db'
import { stripeServerClient } from '../lib/stripe'

async function main() {
  console.log('Testing duplicate customer prevention logic...')

  // Test email - change this to test different scenarios
  const testEmail = 'test-duplicate@example.com'

  // Step 1: Check if a customer with this email already exists in Stripe
  console.log(
    `\nStep 1: Checking if customer with email ${testEmail} exists in Stripe...`
  )
  const existingStripeCustomers = await stripeServerClient.customers.list({
    email: testEmail,
    limit: 10,
  })

  if (existingStripeCustomers.data.length > 0) {
    console.log(
      `Found ${existingStripeCustomers.data.length} existing Stripe customers:`
    )
    existingStripeCustomers.data.forEach((customer) => {
      console.log(
        `- ID: ${customer.id}, Name: ${customer.name}, Created: ${new Date(customer.created * 1000).toISOString()}`
      )
      console.log(`  Metadata:`, customer.metadata)
    })
  } else {
    console.log('No existing Stripe customers found with this email.')
  }

  // Step 2: Check if a student with this email exists in our database
  console.log(
    `\nStep 2: Checking if student with email ${testEmail} exists in our database...`
  )
  const existingStudents = await prisma.student.findMany({
    where: { email: testEmail },
    select: {
      id: true,
      name: true,
      email: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  })

  if (existingStudents.length > 0) {
    console.log(`Found ${existingStudents.length} existing students:`)
    existingStudents.forEach((student) => {
      console.log(`- ID: ${student.id}, Name: ${student.name}`)
      console.log(`  Stripe Customer ID: ${student.stripeCustomerId}`)
      console.log(`  Stripe Subscription ID: ${student.stripeSubscriptionId}`)
      console.log(`  Subscription Status: ${student.subscriptionStatus}`)
    })
  } else {
    console.log('No existing students found with this email.')
  }

  // Step 3: Simulate the prepare-setup logic for simplified schema
  console.log('\nStep 3: Simulating prepare-setup logic...')

  let stripeCustomerId: string | null = null

  // Check if student exists in our database
  if (existingStudents.length > 0) {
    const existingStudent = existingStudents[0]
    console.log(`Found existing student in database: ${existingStudent.id}`)

    if (existingStudent.stripeCustomerId) {
      console.log(
        `Student has Stripe customer ID: ${existingStudent.stripeCustomerId}`
      )

      // Verify this customer still exists in Stripe
      try {
        const stripeCustomer = await stripeServerClient.customers.retrieve(
          existingStudent.stripeCustomerId
        )
        if (!stripeCustomer.deleted) {
          console.log('Stripe customer exists and is not deleted')
          stripeCustomerId = existingStudent.stripeCustomerId
          console.log('Would update existing customer with new details')
        } else {
          console.log('Stripe customer exists but is deleted')
          console.log('Would create new customer and update student record')
        }
      } catch (error) {
        console.log('Error retrieving Stripe customer:', error)
        console.log('Would create new customer and update student record')
      }
    } else {
      console.log('Student has no Stripe customer ID')
      console.log('Would create new customer and update student record')
    }
  }
  // Check if customer exists in Stripe but not linked to any student
  else if (existingStripeCustomers.data.length > 0) {
    console.log(
      'Found existing Stripe customer but no student in database with this email'
    )
    stripeCustomerId = existingStripeCustomers.data[0].id
    console.log(`Would use existing Stripe customer: ${stripeCustomerId}`)
    console.log('Would link this customer to the student being enrolled')
  }
  // No existing customer found anywhere
  else {
    console.log('No existing customer found in database or Stripe')
    console.log('Would create new Stripe customer and link to student')
  }

  // Step 4: Check for potential sibling scenarios
  console.log('\nStep 4: Checking for potential sibling scenarios...')

  // Look for students with similar names or in the same sibling group
  const potentialSiblings = await prisma.student.findMany({
    where: {
      OR: [
        { email: { contains: testEmail.split('@')[0] } },
        {
          name: { contains: testEmail.split('@')[0].replace(/[^a-zA-Z]/g, '') },
        },
      ],
    },
    include: {
      Sibling: {
        include: {
          Student: {
            select: {
              id: true,
              name: true,
              email: true,
              stripeCustomerId: true,
            },
          },
        },
      },
    },
  })

  if (potentialSiblings.length > 0) {
    console.log(`Found ${potentialSiblings.length} potential siblings:`)
    potentialSiblings.forEach((student) => {
      console.log(`- ${student.name} (${student.email})`)
      if (student.Sibling) {
        console.log(
          `  Part of sibling group with ${student.Sibling.Student.length} students`
        )
      }
    })
  }

  console.log('\nTest completed!')
}

main()
  .catch((e) => {
    console.error('Error in test script:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
