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
  DollarSign,
  RotateCcw,
} from 'lucide-react'
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
import {
  useActiveTab,
  useDugsiFilters,
  useLegacyActions,
  useDugsiUIStore,
} from '../store'
import { DashboardFilters } from './dashboard/dashboard-filters'
import { DashboardHeader } from './dashboard/dashboard-header'
import { DugsiStats } from './dashboard/dashboard-stats'
import { QuickFilterChips } from './dashboard/quick-filter-chips'
import { TabContent } from './dashboard/tab-content'

interface DugsiDashboardProps {
  registrations: DugsiRegistration[]
}

export function DugsiDashboard({ registrations }: DugsiDashboardProps) {
  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Persist view mode to localStorage
  usePersistedViewMode()

  // Zustand store state
  const activeTab = useActiveTab()
  const filters = useDugsiFilters()
  const { setActiveTab } = useLegacyActions()
  const clearSelection = useDugsiUIStore((state) => state.clearSelection)
  const selectAllFamilies = useDugsiUIStore((state) => state.selectAllFamilies)

  // Custom hooks for data processing
  const familyGroups = useFamilyGroups(registrations)
  const tabStats = useFamilyStats(familyGroups)

  // Filtering
  const filteredFamilies = useFamilyFilters(familyGroups, {
    tab: activeTab,
    searchQuery: filters.search?.query || '',
    searchField: filters.search?.field || 'all',
    advancedFilters: filters.advanced || {
      dateFilter: 'all',
      hasHealthInfo: false,
    },
    quickShift: filters.quickShift,
  })

  // Export handler
  const handleExport = () => {
    const csvContent = generateFamiliesCSV(filteredFamilies)
    downloadCSV(csvContent)
    toast.success(
      `Exported ${filteredFamilies.length} ${filteredFamilies.length === 1 ? 'family' : 'families'} to CSV`
    )
  }

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onSetActiveTab: setActiveTab,
    onClearSelection: clearSelection,
    onSelectAll: () =>
      selectAllFamilies(filteredFamilies.map((f) => f.familyKey)),
    onExport: handleExport,
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
        <DugsiStats registrations={registrations} onStatClick={setActiveTab} />

        {/* Quick Filter Chips */}
        <QuickFilterChips />

        {/* Main Content Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          aria-label="Family management tabs"
        >
          <TabsList className="flex h-auto w-full justify-start overflow-x-auto sm:grid sm:grid-cols-5">
            <TabsTrigger
              value="active"
              className="flex-shrink-0 gap-1.5 px-3 py-2 text-xs sm:flex-shrink sm:text-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Active</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 text-[10px] sm:text-xs"
              >
                {tabStats.active}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="churned"
              className="flex-shrink-0 gap-1.5 px-3 py-2 text-xs sm:flex-shrink sm:text-sm"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Churned</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 text-[10px] sm:text-xs"
              >
                {tabStats.churned}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="needs-attention"
              className="flex-shrink-0 gap-1.5 px-3 py-2 text-xs sm:flex-shrink sm:text-sm"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Needs Action</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 text-[10px] sm:text-xs"
              >
                {tabStats.needsAttention}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="billing-mismatch"
              className="flex-shrink-0 gap-1.5 px-3 py-2 text-xs sm:flex-shrink sm:text-sm"
            >
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Billing</span>
              {tabStats.billingMismatch > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-amber-100 px-1.5 text-[10px] text-amber-800 sm:text-xs"
                >
                  {tabStats.billingMismatch}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="flex-shrink-0 gap-1.5 px-3 py-2 text-xs sm:flex-shrink sm:text-sm"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">All</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 text-[10px] sm:text-xs"
              >
                {tabStats.all}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {(
            [
              'active',
              'churned',
              'needs-attention',
              'billing-mismatch',
              'all',
            ] as const
          ).map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-6">
              <TabContent families={filteredFamilies} />
            </TabsContent>
          ))}
        </Tabs>

        {/* Command Palette */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onExport={handleExport}
        />
      </div>
    </>
  )
}
