import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { stripeServerClient as stripe } from '@/lib/stripe'

/**
 * GET /api/admin/invoices - Fetch invoices with filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const batchId = searchParams.get('batchId')
    const studentId = searchParams.get('studentId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Build query filters
    const where: any = {}

    if (studentId) {
      where.studentId = studentId
    }

    if (startDate || endDate) {
      where.paidAt = {}
      if (startDate) {
        where.paidAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.paidAt.lte = new Date(endDate)
      }
    }

    // Get payments from database
    const payments = await prisma.studentPayment.findMany({
      where,
      take: limit,
      orderBy: {
        paidAt: 'desc',
      },
      include: {
        Student: {
          include: {
            Batch: true,
          },
        },
      },
    })

    // Get subscription status from students
    const studentIds = [...new Set(payments.map(p => p.studentId))]
    const studentsWithStatus = await prisma.student.findMany({
      where: {
        id: {
          in: studentIds,
        },
      },
      select: {
        id: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    })

    // Map payments to invoice format
    const invoices = payments.map((payment) => {
      const studentStatus = studentsWithStatus.find(s => s.id === payment.studentId)

      return {
        id: payment.id,
        stripeInvoiceId: payment.stripeInvoiceId,
        studentId: payment.studentId,
        studentName: payment.Student.name,
        studentEmail: payment.Student.email,
        batchId: payment.Student.batchId,
        batchName: payment.Student.Batch?.name,
        amount: payment.amountPaid,
        status: payment.paidAt ? 'paid' : 'unpaid',
        subscriptionStatus: studentStatus?.subscriptionStatus,
        paidAt: payment.paidAt,
        year: payment.year,
        month: payment.month,
        stripeCustomerId: studentStatus?.stripeCustomerId,
        stripeSubscriptionId: studentStatus?.stripeSubscriptionId,
      }
    })

    // Filter by status if specified
    let filteredInvoices = invoices
    if (status) {
      if (status === 'paid') {
        filteredInvoices = invoices.filter(i => i.status === 'paid')
      } else if (status === 'unpaid') {
        filteredInvoices = invoices.filter(i => i.status === 'unpaid')
      } else if (status === 'overdue') {
        filteredInvoices = invoices.filter(i => i.subscriptionStatus === 'past_due')
      }
    }

    // Filter by batch if specified
    if (batchId) {
      filteredInvoices = filteredInvoices.filter(i => i.batchId === batchId)
    }

    return NextResponse.json({
      success: true,
      invoices: filteredInvoices,
      total: filteredInvoices.length,
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch invoices',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/invoices/sync - Sync invoices from Stripe
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action !== 'sync') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action',
        },
        { status: 400 }
      )
    }

    console.log('Starting invoice sync from Stripe...')

    // Get all students with Stripe customer IDs
    const students = await prisma.student.findMany({
      where: {
        stripeCustomerId: {
          not: null,
        },
      },
    })

    let totalSynced = 0
    let totalSkipped = 0
    let errors = []

    // Iterate through each student
    for (const student of students) {
      if (!student.stripeCustomerId) continue

      try {
        // Fetch invoices from Stripe for this customer
        const invoices = await stripe.invoices.list({
          customer: student.stripeCustomerId,
          limit: 100,
          expand: ['data.charge'],
        })

        for (const invoice of invoices.data) {
          // Skip draft invoices
          if (invoice.status === 'draft') {
            totalSkipped++
            continue
          }

          // Extract payment date
          const paidAt = invoice.status === 'paid' && invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000)
            : null

          // Extract month and year
          const invoiceDate = new Date((invoice.created || 0) * 1000)
          const month = invoiceDate.getMonth() + 1
          const year = invoiceDate.getFullYear()

          // Check if payment record already exists
          const existingPayment = await prisma.studentPayment.findFirst({
            where: {
              studentId: student.id,
              stripeInvoiceId: invoice.id,
            },
          })

          if (!existingPayment && paidAt) {
            // Create new payment record
            await prisma.studentPayment.create({
              data: {
                id: `${student.id}-${year}-${month}-${invoice.id}`,
                studentId: student.id,
                year,
                month,
                amountPaid: invoice.amount_paid,
                paidAt,
                stripeInvoiceId: invoice.id,
              },
            })
            totalSynced++
          } else if (existingPayment && !existingPayment.paidAt && paidAt) {
            // Update existing payment record if it's now paid
            await prisma.studentPayment.update({
              where: {
                id: existingPayment.id,
              },
              data: {
                amountPaid: invoice.amount_paid,
                paidAt,
              },
            })
            totalSynced++
          } else {
            totalSkipped++
          }
        }
      } catch (error: any) {
        errors.push(`Error syncing invoices for ${student.name}: ${error.message}`)
        console.error(`Error syncing invoices for student ${student.id}:`, error)
      }
    }

    console.log(`Invoice sync complete. Synced: ${totalSynced}, Skipped: ${totalSkipped}`)

    return NextResponse.json({
      success: true,
      totalSynced,
      totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully synced ${totalSynced} invoices from Stripe`,
    })
  } catch (error) {
    console.error('Error syncing invoices from Stripe:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync invoices from Stripe',
      },
      { status: 500 }
    )
  }
}