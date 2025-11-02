/**
 * Dugsi Dashboard Component
 *
 * Main orchestrator component for Dugsi admin dashboard.
 * Uses Zustand store for UI state management.
 * Follows the cohorts pattern for excellent code quality.
 */

'use client'

import { useState } from 'react'

import { Users, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { exportFamiliesToCSV } from '@/lib/csv-export'

import { LiveRegion } from './accessibility/live-region'
import { SkipLink } from './accessibility/skip-link'
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

  return (
    <>
      <SkipLink />
      <div
        id="main-content"
        className="container mx-auto space-y-6 p-4 sm:space-y-8 sm:p-6"
      >
        {/* Live Region for screen reader announcements */}
        <LiveRegion>
          {filteredFamilies.length}{' '}
          {filteredFamilies.length === 1 ? 'family' : 'families'} in {activeTab}{' '}
          tab
        </LiveRegion>

        {/* Header */}
        <DashboardHeader />

        {/* Filters */}
        <DashboardFilters />

        {/* Quick Actions Bar */}
        {selectedFamilyKeys.size > 0 && (
          <QuickActionsBar
            selectedCount={selectedFamilyKeys.size}
            onAction={handleBulkAction}
            onClearSelection={clearSelection}
          />
        )}

        {/* Dashboard Stats */}
        <DashboardStats registrations={registrations} />

        {/* Main Content Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          aria-label="Family management tabs"
        >
          <TabsList className="flex h-auto flex-wrap justify-start sm:grid sm:grid-cols-4">
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

          <TabsContent value="active" className="space-y-6">
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
            <div className="flex items-center justify-end">
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
            <div className="flex items-center justify-end">
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
                ? familyGroups.filter((f) =>
                    selectedFamilyKeys.has(f.familyKey)
                  )
                : filteredFamilies
            exportFamiliesToCSV(familiesToExport)
            toast.success(
              `Exported ${familiesToExport.length} ${familiesToExport.length === 1 ? 'family' : 'families'} to CSV`
            )
          }}
        />
      </div>
    </>
  )
}
