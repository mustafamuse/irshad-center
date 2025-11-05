'use client'

import { useState } from 'react'

import {
  AlertCircle,
  CheckCircle,
  Circle,
  Clock,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VerifyBankDialog } from '@/components/shared/verify-bank-dialog'

import { verifyMahadBankAccount } from '../../actions'

type PaymentFilter =
  | 'all'
  | 'active'
  | 'needs-attention'
  | 'incomplete'
  | 'past-due'

interface Student {
  id: string
  name: string
  parentEmail: string | null
  subscriptionStatus: string | null
  stripeSubscriptionId: string | null
  paymentIntentIdMahad: string | null
  paidUntil: Date | null
}

interface PaymentManagementProps {
  students: Student[]
}

export function PaymentManagement({ students }: PaymentManagementProps) {
  const [activeFilter, setActiveFilter] =
    useState<PaymentFilter>('needs-attention')
  const [searchQuery, setSearchQuery] = useState('')
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  // Calculate stats
  const stats = {
    active: students.filter((s) => s.subscriptionStatus === 'active').length,
    pastDue: students.filter((s) => s.subscriptionStatus === 'past_due')
      .length,
    incomplete: students.filter((s) => s.subscriptionStatus === 'incomplete')
      .length,
    noSubscription: students.filter((s) => !s.stripeSubscriptionId).length,
    total: students.length,
  }

  const healthPercentage = stats.total
    ? Math.round((stats.active / stats.total) * 100)
    : 0

  // Filter logic
  const filteredStudents = students.filter((student) => {
    // Search filter
    const matchesSearch =
      searchQuery === '' ||
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.parentEmail?.toLowerCase().includes(searchQuery.toLowerCase())

    // Status filter
    let matchesStatus = true
    switch (activeFilter) {
      case 'active':
        matchesStatus = student.subscriptionStatus === 'active'
        break
      case 'incomplete':
        matchesStatus = student.subscriptionStatus === 'incomplete'
        break
      case 'past-due':
        matchesStatus = student.subscriptionStatus === 'past_due'
        break
      case 'needs-attention':
        matchesStatus =
          student.subscriptionStatus !== 'active' &&
          student.subscriptionStatus !== null
        break
      case 'all':
      default:
        matchesStatus = true
    }

    return matchesSearch && matchesStatus
  })

  const handleVerifyClick = (student: Student) => {
    setSelectedStudent(student)
    setVerifyDialogOpen(true)
  }

  const needsVerification = (student: Student) => {
    return (
      student.paymentIntentIdMahad &&
      student.subscriptionStatus !== 'active' &&
      student.stripeSubscriptionId
    )
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Active
          </Badge>
        )
      case 'incomplete':
        return (
          <Badge
            variant="secondary"
            className="gap-1 border-yellow-600 text-yellow-600"
          >
            <AlertCircle className="h-3 w-3" />
            Incomplete
          </Badge>
        )
      case 'past_due':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Past Due
          </Badge>
        )
      case 'trialing':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Trialing
          </Badge>
        )
      case 'canceled':
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <XCircle className="h-3 w-3" />
            Canceled
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Circle className="h-2 w-2" />
            No Subscription
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Payment Health Card */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-bold">
            {healthPercentage}%
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              Active Subscriptions
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-semibold">{stats.active}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <div>
                <div className="text-2xl font-semibold">{stats.pastDue}</div>
                <div className="text-xs text-muted-foreground">Past Due</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <div>
                <div className="text-2xl font-semibold">
                  {stats.incomplete}
                </div>
                <div className="text-xs text-muted-foreground">Incomplete</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-600" />
              <div>
                <div className="text-2xl font-semibold">
                  {stats.noSubscription}
                </div>
                <div className="text-xs text-muted-foreground">
                  No Subscription
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={activeFilter}
          onValueChange={(v) => setActiveFilter(v as PaymentFilter)}
        >
          <TabsList className="grid w-full grid-cols-5 lg:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="needs-attention">Needs Attention</TabsTrigger>
            <TabsTrigger value="incomplete">Incomplete</TabsTrigger>
            <TabsTrigger value="past-due">Past Due</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredStudents.length} of {students.length} students
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student Name</TableHead>
              <TableHead>Parent Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid Until</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.parentEmail || 'N/A'}</TableCell>
                  <TableCell>
                    {getStatusBadge(student.subscriptionStatus)}
                  </TableCell>
                  <TableCell>
                    {student.paidUntil
                      ? new Date(student.paidUntil).toLocaleDateString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    {needsVerification(student) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerifyClick(student)}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Verify Bank
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Verify Bank Dialog */}
      {selectedStudent && (
        <VerifyBankDialog
          open={verifyDialogOpen}
          onOpenChange={setVerifyDialogOpen}
          paymentIntentId={selectedStudent.paymentIntentIdMahad!}
          contactEmail={selectedStudent.parentEmail || 'Unknown'}
          program="MAHAD"
          onVerify={verifyMahadBankAccount}
        />
      )}
    </div>
  )
}
