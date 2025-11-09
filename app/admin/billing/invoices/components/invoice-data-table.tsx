'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ExternalLink,
  Search,
  Filter,
  Mail,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Calendar,
  DollarSign,
} from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import type { Student } from '@prisma/client'
import type { StudentWithBatch } from '@/lib/db/queries/student'
import type { StudentPayment } from '@prisma/client'

interface InvoiceDataTableProps {
  students: StudentWithBatch[]
  payments: StudentPayment[]
  studentsWithPayment: Student[]
}

type SortField = 'studentName' | 'amount' | 'status' | 'dueDate' | 'paidAt'
type SortDirection = 'asc' | 'desc'

export function InvoiceDataTable({
  students,
  payments,
  studentsWithPayment,
}: InvoiceDataTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [batchFilter, setBatchFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('paidAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Get unique batches
  const batches = useMemo(() => {
    const uniqueBatches = new Set<string>()
    students.forEach((s) => {
      if (s.batch?.name) {
        uniqueBatches.add(s.batch.name)
      }
    })
    return Array.from(uniqueBatches).sort()
  }, [students])

  // Process and filter invoice data
  const invoiceData = useMemo(() => {
    // Create invoice records from payments and student data
    const invoices = payments.map((payment) => {
      const student = students.find((s) => s.id === payment.studentId)
      const studentPayment = studentsWithPayment.find((s) => s.id === payment.studentId)

      return {
        id: payment.id,
        stripeInvoiceId: payment.stripeInvoiceId,
        studentId: payment.studentId,
        studentName: student?.name || 'Unknown',
        batchName: student?.batch?.name || '',
        amount: payment.amountPaid,
        status: payment.paidAt ? 'paid' : 'unpaid',
        subscriptionStatus: studentPayment?.subscriptionStatus,
        paidAt: payment.paidAt,
        year: payment.year,
        month: payment.month,
        stripeCustomerId: studentPayment?.stripeCustomerId,
      }
    })

    // Apply filters
    let filtered = invoices

    if (searchQuery) {
      filtered = filtered.filter(
        (inv) =>
          inv.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.stripeInvoiceId?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'paid') {
        filtered = filtered.filter((inv) => inv.status === 'paid')
      } else if (statusFilter === 'unpaid') {
        filtered = filtered.filter((inv) => inv.status === 'unpaid')
      } else if (statusFilter === 'overdue') {
        filtered = filtered.filter((inv) => inv.subscriptionStatus === 'past_due')
      }
    }

    if (batchFilter !== 'all') {
      filtered = filtered.filter((inv) => inv.batchName === batchFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let compareValue = 0

      switch (sortField) {
        case 'studentName':
          compareValue = a.studentName.localeCompare(b.studentName)
          break
        case 'amount':
          compareValue = a.amount - b.amount
          break
        case 'status':
          compareValue = a.status.localeCompare(b.status)
          break
        case 'paidAt':
          if (!a.paidAt && !b.paidAt) compareValue = 0
          else if (!a.paidAt) compareValue = 1
          else if (!b.paidAt) compareValue = -1
          else compareValue = new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
          break
        default:
          compareValue = 0
      }

      return sortDirection === 'asc' ? compareValue : -compareValue
    })

    return filtered
  }, [payments, students, studentsWithPayment, searchQuery, statusFilter, batchFilter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getStatusBadge = (status: string, subscriptionStatus?: string | null) => {
    if (status === 'paid') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Paid</Badge>
    } else if (subscriptionStatus === 'past_due') {
      return <Badge variant="destructive">Overdue</Badge>
    } else {
      return <Badge variant="secondary">Unpaid</Badge>
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by student name or invoice ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by batch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {batches.map((batch) => (
                <SelectItem key={batch} value={batch}>
                  {batch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  className="h-8 p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('studentName')}
                >
                  Student
                  <SortIcon field="studentName" />
                </Button>
              </TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  className="h-8 p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('amount')}
                >
                  Amount
                  <SortIcon field="amount" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  className="h-8 p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('status')}
                >
                  Status
                  <SortIcon field="status" />
                </Button>
              </TableHead>
              <TableHead>Period</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  className="h-8 p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('paidAt')}
                >
                  Payment Date
                  <SortIcon field="paidAt" />
                </Button>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoiceData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {searchQuery || statusFilter !== 'all' || batchFilter !== 'all'
                      ? 'No invoices found matching your filters'
                      : 'No invoices found'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              invoiceData.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/students/mahad/${invoice.studentId}`}
                      className="hover:underline"
                    >
                      {invoice.studentName}
                    </Link>
                  </TableCell>
                  <TableCell>{invoice.batchName || '-'}</TableCell>
                  <TableCell>${(invoice.amount / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    {getStatusBadge(invoice.status, invoice.subscriptionStatus)}
                  </TableCell>
                  <TableCell>
                    {invoice.month}/{invoice.year}
                  </TableCell>
                  <TableCell>
                    {invoice.paidAt ? format(new Date(invoice.paidAt), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {invoice.stripeInvoiceId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            window.open(
                              `https://dashboard.stripe.com/invoices/${invoice.stripeInvoiceId}`,
                              '_blank'
                            )
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {invoice.status === 'unpaid' && invoice.stripeInvoiceId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            // TODO: Implement resend invoice action
                            console.log('Resend invoice:', invoice.stripeInvoiceId)
                          }}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {invoiceData.length} of {payments.length} invoices
        </p>
        <p>
          Total: ${(invoiceData.reduce((sum, inv) => sum + inv.amount, 0) / 100).toLocaleString()}
        </p>
      </div>
    </div>
  )
}