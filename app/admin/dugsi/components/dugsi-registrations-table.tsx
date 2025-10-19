'use client'

import { useEffect, useState, useTransition } from 'react'

import { Gender } from '@prisma/client'
import { format } from 'date-fns'
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  School,
  Search,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GenderDisplay, GenderIcon } from '@/components/ui/gender-display'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDebounce } from '@/hooks/use-debounce'
import {
  formatEducationLevel,
  formatGradeLevel,
} from '@/lib/utils/enum-formatters'

import { deleteDugsiFamily, getFamilyMembers } from '../actions'

interface DugsiRegistration {
  id: string
  name: string
  gender: Gender | null
  dateOfBirth: Date | string | null
  educationLevel: string | null
  gradeLevel: string | null
  schoolName: string | null
  healthInfo: string | null
  createdAt: Date | string
  parentFirstName: string | null
  parentLastName: string | null
  parentEmail: string | null
  parentPhone: string | null
  parent2FirstName: string | null
  parent2LastName: string | null
  parent2Email: string | null
  parent2Phone: string | null
}

interface DugsiRegistrationsTableProps {
  registrations: DugsiRegistration[]
}

type DateFilter = 'all' | 'today' | 'yesterday' | 'thisWeek' | 'lastWeek'

function getDateRange(filter: DateFilter): { start: Date; end: Date } | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (filter) {
    case 'all':
      return null
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      }
    case 'yesterday':
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      return {
        start: yesterday,
        end: today,
      }
    case 'thisWeek':
      const dayOfWeek = today.getDay()
      const startOfWeek = new Date(
        today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000
      )
      return {
        start: startOfWeek,
        end: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      }
    case 'lastWeek':
      const dayOfWeek2 = today.getDay()
      const startOfLastWeek = new Date(
        today.getTime() - (dayOfWeek2 + 7) * 24 * 60 * 60 * 1000
      )
      const endOfLastWeek = new Date(
        today.getTime() - dayOfWeek2 * 24 * 60 * 60 * 1000
      )
      return {
        start: startOfLastWeek,
        end: endOfLastWeek,
      }
    default:
      return null
  }
}

export function DugsiRegistrationsTable({
  registrations,
}: DugsiRegistrationsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [selectedRegistration, setSelectedRegistration] =
    useState<DugsiRegistration | null>(null)
  const [familyMembers, setFamilyMembers] = useState<DugsiRegistration[]>([])
  const [isLoadingFamily, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Fetch family members when a registration is selected
  useEffect(() => {
    if (selectedRegistration) {
      startTransition(async () => {
        const family = await getFamilyMembers(selectedRegistration.id)
        setFamilyMembers(family)
      })
    } else {
      setFamilyMembers([])
    }
  }, [selectedRegistration])

  // Handle family deletion
  const handleDeleteFamily = async () => {
    if (!selectedRegistration) return

    startDeleteTransition(async () => {
      const result = await deleteDugsiFamily(selectedRegistration.id)

      if (result.success) {
        toast.success(
          `Successfully deleted ${familyMembers.length} student${familyMembers.length > 1 ? 's' : ''} and their family information`
        )
        setShowDeleteDialog(false)
        setSelectedRegistration(null)
        setFamilyMembers([])
        // The page will automatically update due to revalidatePath in the action
      } else {
        toast.error(result.error || 'Failed to delete family')
      }
    })
  }

  // Filter registrations based on last 4 digits of phone numbers and date
  const filteredRegistrations = registrations.filter((reg) => {
    // Date filter
    const dateRange = getDateRange(dateFilter)
    if (dateRange) {
      const regDate = new Date(reg.createdAt)
      if (regDate < dateRange.start || regDate >= dateRange.end) {
        return false
      }
    }

    // Phone search filter
    if (!debouncedSearch) return true

    // Normalize search query (remove non-digits)
    const searchDigits = debouncedSearch.replace(/\D/g, '')
    if (searchDigits.length < 4) return true

    // Get last 4 digits from search
    const searchLast4 = searchDigits.slice(-4)

    // Check parent 1 phone
    if (reg.parentPhone) {
      const parent1Digits = reg.parentPhone.replace(/\D/g, '')
      if (parent1Digits.endsWith(searchLast4)) return true
    }

    // Check parent 2 phone
    if (reg.parent2Phone) {
      const parent2Digits = reg.parent2Phone.replace(/\D/g, '')
      if (parent2Digits.endsWith(searchLast4)) return true
    }

    return false
  })

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl sm:text-2xl">
              Registered Students
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Total Registrations: {filteredRegistrations.length}
              {(debouncedSearch || dateFilter !== 'all') &&
                ` (filtered from ${registrations.length})`}
            </p>
          </div>
        </div>

        {/* Date Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={dateFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('all')}
            className="text-xs sm:text-sm"
          >
            All Time
          </Button>
          <Button
            variant={dateFilter === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('today')}
            className="text-xs sm:text-sm"
          >
            Today
          </Button>
          <Button
            variant={dateFilter === 'yesterday' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('yesterday')}
            className="text-xs sm:text-sm"
          >
            Yesterday
          </Button>
          <Button
            variant={dateFilter === 'thisWeek' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('thisWeek')}
            className="text-xs sm:text-sm"
          >
            This Week
          </Button>
          <Button
            variant={dateFilter === 'lastWeek' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('lastWeek')}
            className="text-xs sm:text-sm"
          >
            Last Week
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by last 4 digits of parent phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mobile Card Layout */}
        <div className="block space-y-4 p-4 sm:p-6 lg:hidden">
          {filteredRegistrations.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No registrations found.
            </div>
          ) : (
            filteredRegistrations.map((registration) => (
              <MobileRegistrationCard
                key={registration.id}
                registration={registration}
                onSelect={setSelectedRegistration}
              />
            ))
          )}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden lg:block">
          <p className="mb-3 px-6 text-sm text-muted-foreground">
            Click any row to view full details
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child Name</TableHead>
                  <TableHead className="w-16">Gender</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No registrations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegistrations.map((registration) => (
                    <TableRow
                      key={registration.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedRegistration(registration)}
                    >
                      <TableCell className="font-medium">
                        {registration.name}
                      </TableCell>
                      <TableCell className="w-16">
                        <GenderIcon gender={registration.gender} size="lg" />
                      </TableCell>
                      <TableCell className="text-sm">
                        {registration.parentFirstName ||
                        registration.parentLastName ? (
                          <div className="flex items-center gap-2">
                            <span>
                              {[
                                registration.parentFirstName,
                                registration.parentLastName,
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            </span>
                            {(registration.parent2FirstName ||
                              registration.parent2LastName) && (
                              <Badge
                                variant="secondary"
                                className="px-1.5 text-[10px]"
                              >
                                +1
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {registration.parentPhone ? (
                          <div className="flex items-center gap-2">
                            <span>{registration.parentPhone}</span>
                            {registration.parent2Phone && (
                              <Badge
                                variant="secondary"
                                className="px-1.5 text-[10px]"
                              >
                                +1
                              </Badge>
                            )}
                          </div>
                        ) : registration.parent2Phone ? (
                          <span>{registration.parent2Phone}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(registration.createdAt)}
                      </TableCell>
                      <TableCell className="w-12">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>

      {/* Detail Drawer */}
      <Sheet
        open={!!selectedRegistration}
        onOpenChange={(open) => !open && setSelectedRegistration(null)}
      >
        <SheetContent className="flex w-full flex-col sm:max-w-3xl">
          {selectedRegistration && (
            <>
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                <SheetHeader className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#007078]/10">
                      <Users className="h-6 w-6 text-[#007078]" />
                    </div>
                    <div>
                      <SheetTitle className="text-2xl">
                        Family Registration
                      </SheetTitle>
                      <SheetDescription className="mt-1">
                        {isLoadingFamily ? (
                          'Loading family details...'
                        ) : (
                          <>
                            {familyMembers.length} child
                            {familyMembers.length !== 1 ? 'ren' : ''} enrolled
                          </>
                        )}
                      </SheetDescription>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  {!isLoadingFamily && familyMembers.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-[#007078]">
                          {familyMembers.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {familyMembers.length === 1 ? 'Child' : 'Children'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-[#007078]">
                          {selectedRegistration.parentPhone &&
                          selectedRegistration.parent2Phone
                            ? '2'
                            : '1'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedRegistration.parent2Phone
                            ? 'Parents'
                            : 'Parent'}
                        </p>
                      </div>
                    </div>
                  )}
                </SheetHeader>

                {isLoadingFamily ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#007078]" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      Loading family details...
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-6">
                    {/* Parent Information */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007078]/10">
                          <User className="h-4 w-4 text-[#007078]" />
                        </div>
                        <h3 className="text-lg font-semibold">Parents</h3>
                      </div>

                      <div className="space-y-3">
                        {/* Parent 1 */}
                        <Card className="overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    Parent 1
                                  </Badge>
                                  <p className="font-semibold">
                                    {[
                                      selectedRegistration.parentFirstName,
                                      selectedRegistration.parentLastName,
                                    ]
                                      .filter(Boolean)
                                      .join(' ') || 'Not provided'}
                                  </p>
                                </div>

                                <div className="space-y-1.5">
                                  {selectedRegistration.parentEmail && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Mail className="h-3.5 w-3.5" />
                                      <a
                                        href={`mailto:${selectedRegistration.parentEmail}`}
                                        className="hover:text-[#007078] hover:underline"
                                      >
                                        {selectedRegistration.parentEmail}
                                      </a>
                                    </div>
                                  )}
                                  {selectedRegistration.parentPhone && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Phone className="h-3.5 w-3.5" />
                                      <a
                                        href={`tel:${selectedRegistration.parentPhone}`}
                                        className="hover:text-[#007078] hover:underline"
                                      >
                                        {selectedRegistration.parentPhone}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Parent 2 */}
                        {(selectedRegistration.parent2FirstName ||
                          selectedRegistration.parent2LastName ||
                          selectedRegistration.parent2Email ||
                          selectedRegistration.parent2Phone) && (
                          <Card className="overflow-hidden">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Parent 2
                                    </Badge>
                                    <p className="font-semibold">
                                      {[
                                        selectedRegistration.parent2FirstName,
                                        selectedRegistration.parent2LastName,
                                      ]
                                        .filter(Boolean)
                                        .join(' ') || 'Not provided'}
                                    </p>
                                  </div>

                                  <div className="space-y-1.5">
                                    {selectedRegistration.parent2Email && (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Mail className="h-3.5 w-3.5" />
                                        <a
                                          href={`mailto:${selectedRegistration.parent2Email}`}
                                          className="hover:text-[#007078] hover:underline"
                                        >
                                          {selectedRegistration.parent2Email}
                                        </a>
                                      </div>
                                    )}
                                    {selectedRegistration.parent2Phone && (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Phone className="h-3.5 w-3.5" />
                                        <a
                                          href={`tel:${selectedRegistration.parent2Phone}`}
                                          className="hover:text-[#007078] hover:underline"
                                        >
                                          {selectedRegistration.parent2Phone}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>

                    {/* Children */}
                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007078]/10">
                          <GraduationCap className="h-4 w-4 text-[#007078]" />
                        </div>
                        <h3 className="text-lg font-semibold">Children</h3>
                      </div>

                      <div className="space-y-3">
                        {familyMembers.map((child, index) => (
                          <Card
                            key={child.id}
                            className={`transition-all ${
                              child.id === selectedRegistration.id
                                ? 'border-[#007078] bg-[#007078]/5 shadow-sm'
                                : 'border-border hover:border-[#007078]/30'
                            }`}
                          >
                            <CardContent className="p-4">
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#007078] text-sm font-bold text-white">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-semibold">
                                        {child.name}
                                      </h4>
                                      {child.gender && (
                                        <GenderDisplay
                                          gender={child.gender}
                                          size="sm"
                                          showLabel={true}
                                        />
                                      )}
                                      {child.id === selectedRegistration.id && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px]"
                                        >
                                          ✓ Selected
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      Registered {formatDate(child.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                {child.dateOfBirth && (
                                  <div className="flex items-start gap-2">
                                    <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">
                                        Age
                                      </p>
                                      <p className="text-sm font-medium">
                                        {calculateAge(child.dateOfBirth)}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-start gap-2">
                                  <GraduationCap className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Grade
                                    </p>
                                    <p className="text-sm font-medium">
                                      {formatGradeLevel(child.gradeLevel)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2">
                                  <GraduationCap className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Education Level
                                    </p>
                                    <p className="text-sm font-medium">
                                      {formatEducationLevel(
                                        child.educationLevel
                                      )}
                                    </p>
                                  </div>
                                </div>

                                {child.schoolName && (
                                  <div className="flex items-start gap-2">
                                    <School className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-xs text-muted-foreground">
                                        School
                                      </p>
                                      <p className="text-sm font-medium">
                                        {child.schoolName}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {child.healthInfo &&
                                  child.healthInfo.toLowerCase() !== 'none' && (
                                    <div className="flex items-start gap-2 sm:col-span-2">
                                      <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
                                      <div>
                                        <p className="text-xs text-red-600">
                                          Health Information
                                        </p>
                                        <p className="text-sm font-medium text-red-600">
                                          {child.healthInfo}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with Delete Button */}
              {!isLoadingFamily && (
                <div className="border-t bg-background p-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isDeleting}
                    className="w-full gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Entire Family
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    This action cannot be undone
                  </p>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entire Family?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete{' '}
              <span className="font-semibold text-foreground">
                {familyMembers.length} student
                {familyMembers.length > 1 ? 's' : ''}
              </span>{' '}
              and all their parent information:
            </AlertDialogDescription>
            <div className="space-y-3 pt-2">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {familyMembers.map((child) => (
                  <li key={child.id}>{child.name}</li>
                ))}
              </ul>
              <p className="text-sm font-semibold text-destructive">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteFamily()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Family'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

interface MobileRegistrationCardProps {
  registration: DugsiRegistration
  onSelect: (registration: DugsiRegistration) => void
}

function MobileRegistrationCard({
  registration,
  onSelect,
}: MobileRegistrationCardProps) {
  return (
    <Card
      className="cursor-pointer overflow-hidden border-l-4 border-l-[#007078] transition-colors hover:bg-muted/30"
      onClick={() => onSelect(registration)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            {/* Child Name */}
            <div>
              <p className="text-[11px] text-muted-foreground">Child</p>
              <p className="text-sm font-medium text-gray-900">
                {registration.name}
              </p>
            </div>

            {/* Gender */}
            {registration.gender && (
              <div>
                <p className="text-[11px] text-muted-foreground">Gender</p>
                <GenderDisplay
                  gender={registration.gender}
                  size="md"
                  showLabel={true}
                />
              </div>
            )}

            {/* Parent */}
            <div>
              <p className="text-[11px] text-muted-foreground">Parent</p>
              {registration.parentFirstName || registration.parentLastName ? (
                <div className="flex items-center gap-1.5">
                  <p className="text-sm">
                    {[registration.parentFirstName, registration.parentLastName]
                      .filter(Boolean)
                      .join(' ')}
                  </p>
                  {(registration.parent2FirstName ||
                    registration.parent2LastName) && (
                    <Badge variant="secondary" className="px-1 text-[10px]">
                      +1
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <p className="text-[11px] text-muted-foreground">Phone</p>
              {registration.parentPhone ? (
                <div className="flex items-center gap-1.5">
                  <p className="text-sm">{registration.parentPhone}</p>
                  {registration.parent2Phone && (
                    <Badge variant="secondary" className="px-1 text-[10px]">
                      +1
                    </Badge>
                  )}
                </div>
              ) : registration.parent2Phone ? (
                <p className="text-sm">{registration.parent2Phone}</p>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>

            {/* Registration Date */}
            <div>
              <p className="text-[11px] text-muted-foreground">Registered</p>
              <p className="text-sm">{formatDate(registration.createdAt)}</p>
            </div>
          </div>
          <ChevronRight className="ml-2 mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(value: Date | string | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  return format(date, 'MMM d, yyyy')
}

function calculateAge(dateOfBirth: Date | string | null): string {
  if (!dateOfBirth) return 'N/A'

  const birthDate =
    dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth)
  const today = new Date()

  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  // Adjust age if birthday hasn't occurred this year yet
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }

  return `${age} years old`
}
