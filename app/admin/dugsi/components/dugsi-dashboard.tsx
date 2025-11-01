'use client'

import { useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

import {
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Search,
  Filter,
  Loader2,
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
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AdvancedFilters } from './advanced-filters'
import { DugsiRegistrationsTable } from './dugsi-registrations-table'
import { DugsiStats } from './dugsi-stats'
import { FamilyGridView } from './family-grid-view'
import { QuickActionsBar } from './quick-actions-bar'
import { useFamilyFilters } from '../_hooks/use-family-filters'
import { useFamilyGroups, useFamilyStats } from '../_hooks/use-family-groups'
import { DugsiRegistration, TabValue, ViewMode, FamilyFilters } from '../_types'
import { deleteDugsiFamily } from '../actions'

interface DugsiDashboardProps {
  registrations: DugsiRegistration[]
}

export function DugsiDashboard({ registrations }: DugsiDashboardProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabValue>('overview')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(
    new Set()
  )
  const [filters, setFilters] = useState<FamilyFilters>({
    dateRange: null,
    schools: [],
    grades: [],
    hasHealthInfo: false,
  })
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()

  // Use custom hooks for family grouping and stats
  const familyGroups = useFamilyGroups(registrations)
  const tabStats = useFamilyStats(familyGroups)

  // Use custom hook for filtering
  const filteredFamilies = useFamilyFilters(familyGroups, {
    tab: activeTab,
    searchQuery,
    advancedFilters: filters,
  })

  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'delete':
        if (selectedFamilies.size > 0) {
          setShowDeleteDialog(true)
        }
        break
      case 'send-payment-link':
        toast.info(`Sending payment links to ${selectedFamilies.size} families`)
        // TODO: Implement send payment link
        break
      case 'link-subscription':
        toast.info(
          `Linking subscriptions for ${selectedFamilies.size} families`
        )
        // TODO: Implement link subscription
        break
      case 'export':
        toast.info(`Exporting ${selectedFamilies.size} families to CSV`)
        // TODO: Implement export
        break
      default:
        console.log(`Performing ${action} on ${selectedFamilies.size} families`)
    }
  }

  const handleDeleteFamilies = async () => {
    if (selectedFamilies.size === 0) return

    startDeleteTransition(async () => {
      const familyIds = Array.from(selectedFamilies)
      let successCount = 0
      let errorCount = 0

      for (const familyKey of familyIds) {
        // Find the first student from this family to get the ID
        const family = familyGroups.find((f) => f.familyKey === familyKey)
        if (family && family.members.length > 0) {
          const result = await deleteDugsiFamily(family.members[0].id)
          if (result.success) {
            successCount++
          } else {
            errorCount++
            console.error(`Failed to delete family ${familyKey}:`, result.error)
          }
        }
      }

      if (successCount > 0) {
        toast.success(
          `Successfully deleted ${successCount} ${successCount === 1 ? 'family' : 'families'}`
        )
        setSelectedFamilies(new Set())
        router.refresh()
      }

      if (errorCount > 0) {
        toast.error(
          `Failed to delete ${errorCount} ${errorCount === 1 ? 'family' : 'families'}`
        )
      }

      setShowDeleteDialog(false)
    })
  }

  return (
    <div className="container mx-auto space-y-6 p-4 sm:space-y-8 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Dugsi Program Management
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Manage student registrations and family subscriptions
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2" role="group" aria-label="View mode">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            aria-label="Grid view"
          >
            Grid View
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            aria-pressed={viewMode === 'table'}
            aria-label="Table view"
          >
            Table View
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, email, phone, or school..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search families by name, email, phone, or school"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
          aria-expanded={showFilters}
          aria-controls="advanced-filters-panel"
        >
          <Filter className="h-4 w-4" />
          Advanced Filters
          {(filters.dateRange ||
            filters.schools.length > 0 ||
            filters.grades.length > 0 ||
            filters.hasHealthInfo) && (
            <Badge
              variant="secondary"
              className="ml-1"
              aria-label="Active filters"
            >
              Active
            </Badge>
          )}
        </Button>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div
          id="advanced-filters-panel"
          role="region"
          aria-label="Advanced filters"
        >
          <AdvancedFilters
            filters={filters}
            onFiltersChange={setFilters}
            registrations={registrations}
          />
        </div>
      )}

      {/* Quick Actions Bar */}
      {selectedFamilies.size > 0 && (
        <QuickActionsBar
          selectedCount={selectedFamilies.size}
          onAction={handleBulkAction}
          onClearSelection={() => setSelectedFamilies(new Set())}
        />
      )}

      {/* Main Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        aria-label="Family management tabs"
      >
        <TabsList className="flex h-auto flex-wrap justify-start sm:grid sm:grid-cols-5">
          <TabsTrigger
            value="overview"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
          <TabsTrigger
            value="active"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Active</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
            >
              {tabStats.active}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Pending</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
            >
              {tabStats.pending}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="needs-attention"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Needs Action</span>
            <span className="sm:hidden">Action</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
            >
              {tabStats.needsAttention}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">All</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
            >
              {tabStats.all}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <DugsiStats registrations={registrations} />

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>
                Recent Registrations
                {(searchQuery ||
                  filters.dateRange ||
                  filters.schools.length > 0 ||
                  filters.grades.length > 0 ||
                  filters.hasHealthInfo) && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (filtered: showing {Math.min(filteredFamilies.length, 6)} of{' '}
                    {filteredFamilies.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredFamilies.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No families match the current filters
                </div>
              ) : (
                <FamilyGridView
                  families={filteredFamilies.slice(0, 6)}
                  selectedFamilies={selectedFamilies}
                  onSelectionChange={setSelectedFamilies}
                  viewMode="compact"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Active Subscriptions ({filteredFamilies.length} families)
            </h2>
          </div>
          {viewMode === 'grid' ? (
            <FamilyGridView
              families={filteredFamilies}
              selectedFamilies={selectedFamilies}
              onSelectionChange={setSelectedFamilies}
            />
          ) : (
            <DugsiRegistrationsTable
              registrations={filteredFamilies.flatMap((f) => f.members)}
            />
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Pending Setup ({filteredFamilies.length} families)
            </h2>
            <Button
              size="sm"
              onClick={() => handleBulkAction('send-reminders')}
            >
              Send Setup Reminders
            </Button>
          </div>
          {viewMode === 'grid' ? (
            <FamilyGridView
              families={filteredFamilies}
              selectedFamilies={selectedFamilies}
              onSelectionChange={setSelectedFamilies}
            />
          ) : (
            <DugsiRegistrationsTable
              registrations={filteredFamilies.flatMap((f) => f.members)}
            />
          )}
        </TabsContent>

        <TabsContent value="needs-attention" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Needs Attention ({filteredFamilies.length} families)
            </h2>
            <Button
              size="sm"
              onClick={() => handleBulkAction('send-payment-links')}
            >
              Send Payment Links
            </Button>
          </div>
          {viewMode === 'grid' ? (
            <FamilyGridView
              families={filteredFamilies}
              selectedFamilies={selectedFamilies}
              onSelectionChange={setSelectedFamilies}
            />
          ) : (
            <DugsiRegistrationsTable
              registrations={filteredFamilies.flatMap((f) => f.members)}
            />
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              All Families ({filteredFamilies.length} families)
            </h2>
          </div>
          {viewMode === 'grid' ? (
            <FamilyGridView
              families={filteredFamilies}
              selectedFamilies={selectedFamilies}
              onSelectionChange={setSelectedFamilies}
            />
          ) : (
            <DugsiRegistrationsTable
              registrations={filteredFamilies.flatMap((f) => f.members)}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedFamilies.size}{' '}
              {selectedFamilies.size === 1 ? 'Family' : 'Families'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the selected{' '}
              {selectedFamilies.size === 1 ? 'family' : 'families'} including:
            </AlertDialogDescription>
            <div className="space-y-2 pt-2">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>All student records</li>
                <li>Parent information</li>
                <li>Payment history</li>
                <li>Subscription data</li>
              </ul>
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                <p className="text-sm font-semibold text-destructive">
                  Warning: This action cannot be undone!
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Array.from(selectedFamilies)
                    .map((familyKey) => {
                      const family = familyGroups.find(
                        (f) => f.familyKey === familyKey
                      )
                      return family
                        ? `${family.members.length} student(s) from ${family.parentEmail || 'family'}`
                        : null
                    })
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteFamilies()
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
                `Delete ${selectedFamilies.size} ${selectedFamilies.size === 1 ? 'Family' : 'Families'}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
