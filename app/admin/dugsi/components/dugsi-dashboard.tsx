/**
 * Dugsi Dashboard Component
 *
 * Main orchestrator component for Dugsi admin dashboard.
 * Uses Zustand store for UI state management.
 * Follows the cohorts pattern for excellent code quality.
 */

'use client'

import { useState } from 'react'

import {
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { exportFamiliesToCSV } from '@/lib/csv-export'

import { CommandPalette } from './command-palette'
import { useFamilyFilters } from '../_hooks/use-family-filters'
import { useFamilyGroups, useFamilyStats } from '../_hooks/use-family-groups'
import { DugsiRegistration } from '../_types'
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts'
import { usePersistedViewMode } from '../hooks/use-persisted-view-mode'
import {
  useActiveTab,
  useSelectedFamilies,
  useViewMode,
  useDugsiFilters,
  useLegacyActions,
} from '../store'
import { DashboardFilters } from './dashboard/dashboard-filters'
import { DashboardHeader } from './dashboard/dashboard-header'
import { DashboardStats } from './dashboard/dashboard-stats'
import { DeleteFamilyDialog } from './dialogs/delete-family-dialog'
import { FamilyGridView } from './family-management/family-grid-view'
import { QuickActionsBar } from './quick-actions/quick-actions-bar'
import { DugsiRegistrationsTable } from './registrations/registrations-table'

interface DugsiDashboardProps {
  registrations: DugsiRegistration[]
}

export function DugsiDashboard({ registrations }: DugsiDashboardProps) {
  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Persist view mode to localStorage
  usePersistedViewMode()

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
  })

  // Zustand store state
  const activeTab = useActiveTab()
  const viewMode = useViewMode()
  const selectedFamilyKeys = useSelectedFamilies()
  const filters = useDugsiFilters()
  const {
    setActiveTab,
    clearSelection,
    setDeleteDialogOpen,
    selectAllFamilies,
    resetFilters,
  } = useLegacyActions()

  // Custom hooks for data processing
  const familyGroups = useFamilyGroups(registrations)
  const tabStats = useFamilyStats(familyGroups)

  // Filtering
  const filteredFamilies = useFamilyFilters(familyGroups, {
    tab: activeTab,
    searchQuery: filters.search?.query || '',
    advancedFilters: filters.advanced || {
      dateRange: null,
      schools: [],
      grades: [],
      hasHealthInfo: false,
    },
  })

  // Bulk action handler
  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'delete':
        if (selectedFamilyKeys.size > 0) {
          setDeleteDialogOpen(true)
        }
        break
      case 'send-payment-link':
        toast.info(
          `Sending payment links to ${selectedFamilyKeys.size} families`
        )
        // TODO: Implement send payment link (GitHub issue #27)
        break
      case 'link-subscription':
        toast.info(
          `Linking subscriptions for ${selectedFamilyKeys.size} families`
        )
        // TODO: Implement link subscription (GitHub issue #27)
        break
      case 'export': {
        const selectedFamilies = familyGroups.filter((f) =>
          selectedFamilyKeys.has(f.familyKey)
        )
        exportFamiliesToCSV(selectedFamilies)
        toast.success(
          `Exported ${selectedFamilyKeys.size} ${selectedFamilyKeys.size === 1 ? 'family' : 'families'} to CSV`
        )
        break
      }
      default:
        console.log(
          `Performing ${action} on ${selectedFamilyKeys.size} families`
        )
    }
  }

  const handleSelectionChange = (keys: Set<string>) => {
    selectAllFamilies(Array.from(keys))
  }

  const hasActiveFilters =
    (filters.search?.query?.trim().length ?? 0) > 0 ||
    filters.advanced?.dateRange !== null ||
    (filters.advanced?.schools.length ?? 0) > 0 ||
    (filters.advanced?.grades.length ?? 0) > 0 ||
    filters.advanced?.hasHealthInfo === true

  return (
    <div className="container mx-auto space-y-6 p-4 sm:space-y-8 sm:p-6">
      {/* Header */}
      <DashboardHeader />

      {/* Filters */}
      <DashboardFilters registrations={registrations} />

      {/* Quick Actions Bar */}
      {selectedFamilyKeys.size > 0 && (
        <QuickActionsBar
          selectedCount={selectedFamilyKeys.size}
          onAction={handleBulkAction}
          onClearSelection={clearSelection}
        />
      )}

      {/* Main Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
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
          <DashboardStats registrations={registrations} />

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>
                Recent Registrations
                {hasActiveFilters && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (filtered: showing {Math.min(filteredFamilies.length, 6)} of{' '}
                    {filteredFamilies.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredFamilies.length === 0 ? (
                <EmptyState
                  icon={<Filter className="h-8 w-8" />}
                  title="No families match your filters"
                  description="Try adjusting your search or filter criteria to see results."
                  action={{
                    label: 'Clear Filters',
                    onClick: resetFilters,
                    variant: 'outline',
                  }}
                />
              ) : viewMode === 'grid' ? (
                <FamilyGridView
                  families={filteredFamilies.slice(0, 6)}
                  selectedFamilies={selectedFamilyKeys}
                  onSelectionChange={handleSelectionChange}
                  viewMode="compact"
                />
              ) : (
                <DugsiRegistrationsTable
                  registrations={filteredFamilies
                    .flatMap((f) => f.members)
                    .slice(0, 6)}
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
              selectedFamilies={selectedFamilyKeys}
              onSelectionChange={handleSelectionChange}
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
              selectedFamilies={selectedFamilyKeys}
              onSelectionChange={handleSelectionChange}
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
              selectedFamilies={selectedFamilyKeys}
              onSelectionChange={handleSelectionChange}
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
              selectedFamilies={selectedFamilyKeys}
              onSelectionChange={handleSelectionChange}
            />
          ) : (
            <DugsiRegistrationsTable
              registrations={filteredFamilies.flatMap((f) => f.members)}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <DeleteFamilyDialog families={familyGroups} />

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onExport={() => {
          // Export selected families if any, otherwise export all filtered
          const familiesToExport =
            selectedFamilyKeys.size > 0
              ? familyGroups.filter((f) => selectedFamilyKeys.has(f.familyKey))
              : filteredFamilies
          exportFamiliesToCSV(familiesToExport)
          toast.success(
            `Exported ${familiesToExport.length} ${familiesToExport.length === 1 ? 'family' : 'families'} to CSV`
          )
        }}
      />
    </div>
  )
}
