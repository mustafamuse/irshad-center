'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Search,
  ExternalLink,
  Mail,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react'
import type { StudentWithBatch } from '@/lib/db/queries/student'
import Link from 'next/link'

interface BillingStudentsTableProps {
  students: StudentWithBatch[]
  showPaymentStatus?: boolean
  actionType?: 'setup' | 'recover' | 'review'
}

export function BillingStudentsTable({
  students,
  showPaymentStatus = true,
  actionType = 'review'
}: BillingStudentsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter students based on search
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.parentEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'past_due':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'incomplete':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'canceled':
        return <XCircle className="h-4 w-4 text-gray-600" />
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>
      case 'incomplete':
        return <Badge className="bg-yellow-100 text-yellow-800">Incomplete</Badge>
      case 'canceled':
        return <Badge variant="secondary">Canceled</Badge>
      case 'trialing':
        return <Badge className="bg-blue-100 text-blue-800">Trial</Badge>
      default:
        return <Badge variant="outline">No Subscription</Badge>
    }
  }

  const getActionButton = (student: StudentWithBatch) => {
    switch (actionType) {
      case 'setup':
        return (
          <Button size="sm" variant="default">
            <DollarSign className="h-3 w-3 mr-1" />
            Setup Billing
          </Button>
        )
      case 'recover':
        return (
          <Button size="sm" variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Recover Payment
          </Button>
        )
      default:
        return (
          <Link href={`/admin/students/mahad?student=${student.id}`}>
            <Button size="sm" variant="outline">
              <ExternalLink className="h-3 w-3 mr-1" />
              View Details
            </Button>
          </Link>
        )
    }
  }

  if (students.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No students to display</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Badge variant="secondary">{filteredStudents.length} results</Badge>
      </div>

      {/* Students Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Cohort</TableHead>
              {showPaymentStatus && <TableHead>Payment Status</TableHead>}
              <TableHead>Monthly Rate</TableHead>
              <TableHead>Last Payment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium">{student.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {student.id.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {student.parentEmail ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3" />
                        {student.parentEmail}
                      </div>
                    ) : student.email ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3" />
                        {student.email}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No email</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {student.Batch ? (
                    <Badge variant="outline">{student.Batch.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Unassigned</span>
                  )}
                </TableCell>
                {showPaymentStatus && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(student.subscriptionStatus)}
                      {getStatusBadge(student.subscriptionStatus)}
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <div className="font-medium">
                    ${student.monthlyRate}/mo
                    {student.customRate && (
                      <Badge variant="outline" className="ml-1 text-xs">Custom</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {student.lastPaymentDate ? (
                    <span className="text-sm">
                      {new Date(student.lastPaymentDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {getActionButton(student)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Summary Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {filteredStudents.length} of {students.length} students
        </div>
        <div>
          Total Monthly Revenue: $
          {filteredStudents.reduce((sum, s) => sum + (s.monthlyRate || 0), 0).toLocaleString()}
        </div>
      </div>
    </div>
  )
}