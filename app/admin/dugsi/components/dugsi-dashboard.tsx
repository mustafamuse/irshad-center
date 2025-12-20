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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { generateFamiliesCSV } from '@/lib/csv-export'

import { downloadCSV } from '../hooks/use-csv-download'
import { LiveRegion } from './accessibility/live-region'
import { SkipLink } from './accessibility/skip-link'
import { CommandPalette } from './command-palette'
import { useFamilyFilters } from '../_hooks/use-family-filters'
import { useFamilyGroups, useFamilyStats } from '../_hooks/use-family-groups'
import { DugsiRegistration } from '../_types'
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts'
import { usePersistedViewMode } from '../hooks/use-persisted-view-mode'
import { useActiveTab, useDugsiFilters, useLegacyActions } from '../store'
import { DashboardFilters } from './dashboard/dashboard-filters'
import { DashboardHeader } from './dashboard/dashboard-header'
import { DugsiStats } from './dashboard/dashboard-stats'
import { TabContent } from './dashboard/tab-content'

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
  const filters = useDugsiFilters()
  const { setActiveTab } = useLegacyActions()

  // Custom hooks for data processing
  const familyGroups = useFamilyGroups(registrations)
  const tabStats = useFamilyStats(familyGroups)

  // Filtering
  const filteredFamilies = useFamilyFilters(familyGroups, {
    tab: activeTab,
    searchQuery: filters.search?.query || '',
    advancedFilters: filters.advanced || {
      dateFilter: 'all',
      hasHealthInfo: false,
    },
  })

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

        {/* Dashboard Stats */}
        <DugsiStats registrations={registrations} />

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
            <TabContent families={filteredFamilies} />
          </TabsContent>

          <TabsContent value="pending" className="space-y-6">
            <TabContent families={filteredFamilies} />
          </TabsContent>

          <TabsContent value="needs-attention" className="space-y-6">
            <TabContent families={filteredFamilies} />
          </TabsContent>

          <TabsContent value="all" className="space-y-6">
            <TabContent families={filteredFamilies} />
          </TabsContent>
        </Tabs>

        {/* Command Palette */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onExport={() => {
            const csvContent = generateFamiliesCSV(filteredFamilies)
            downloadCSV(csvContent)
            toast.success(
              `Exported ${filteredFamilies.length} ${filteredFamilies.length === 1 ? 'family' : 'families'} to CSV`
            )
          }}
        />
      </div>
    </>
  )
}
