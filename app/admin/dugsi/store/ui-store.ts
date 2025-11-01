/**
 * UI-Only State Store for Dugsi Admin
 *
 * Simplified store managing only UI state (filters, selections, dialog states).
 * Server data (registrations) should be fetched in Server Components
 * and passed down as props to Client Components.
 *
 * Follows the same pattern as app/admin/mahad/cohorts/store/ui-store.ts
 */

import { enableMapSet } from 'immer'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { FamilyFilters, TabValue, ViewMode } from '../_types'

// Enable Immer MapSet plugin for using Set in the store
enableMapSet()

// ============================================================================
// TYPES
// ============================================================================

export interface DugsiFilters {
  search?: {
    query: string
    fields: ('name' | 'email' | 'phone' | 'school')[]
  }
  advanced?: FamilyFilters
  tab?: TabValue
}

interface DugsiUIStore {
  // ============================================================================
  // STATE
  // ============================================================================
  selectedFamilyKeys: Set<string>
  viewMode: ViewMode
  activeTab: TabValue
  filters: DugsiFilters
  showAdvancedFilters: boolean
  isDeleteDialogOpen: boolean
  isLinkSubscriptionDialogOpen: boolean
  linkSubscriptionDialogParentEmail: string | null

  // ============================================================================
  // CORE ACTIONS
  // ============================================================================

  // Selection actions
  toggleFamilySelection: (key: string) => void
  setFamilySelection: (keys: string[]) => void
  clearFamilySelection: () => void

  // Filter actions
  updateFilters: (updates: Partial<DugsiFilters>) => void
  setSearchQuery: (query: string) => void
  setAdvancedFilters: (filters: FamilyFilters) => void
  resetFilters: () => void

  // View actions
  setViewMode: (mode: ViewMode) => void
  setActiveTab: (tab: TabValue) => void

  // Dialog actions
  setDialogOpen: (
    dialog: 'delete' | 'linkSubscription' | 'advancedFilters',
    open: boolean
  ) => void
  setLinkSubscriptionDialogData: (parentEmail: string | null) => void

  // Utility actions
  reset: () => void
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const defaultFilters: DugsiFilters = {
  search: {
    query: '',
    fields: ['name', 'email', 'phone', 'school'],
  },
  advanced: {
    dateRange: null,
    schools: [],
    grades: [],
    hasHealthInfo: false,
  },
  tab: 'overview',
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useDugsiUIStore = create<DugsiUIStore>()(
  devtools(
    immer((set) => ({
      // Initial state
      selectedFamilyKeys: new Set(),
      viewMode: 'grid',
      activeTab: 'overview',
      filters: defaultFilters,
      showAdvancedFilters: false,
      isDeleteDialogOpen: false,
      isLinkSubscriptionDialogOpen: false,
      linkSubscriptionDialogParentEmail: null,

      // ========================================================================
      // SELECTION ACTIONS
      // ========================================================================

      toggleFamilySelection: (key) =>
        set((state) => {
          if (state.selectedFamilyKeys.has(key)) {
            state.selectedFamilyKeys.delete(key)
          } else {
            state.selectedFamilyKeys.add(key)
          }
        }),

      setFamilySelection: (keys) =>
        set((state) => {
          state.selectedFamilyKeys = new Set(keys)
        }),

      clearFamilySelection: () =>
        set((state) => {
          state.selectedFamilyKeys = new Set()
        }),

      // ========================================================================
      // FILTER ACTIONS
      // ========================================================================

      updateFilters: (updates) =>
        set((state) => {
          state.filters = { ...state.filters, ...updates }
        }),

      setSearchQuery: (query) =>
        set((state) => {
          if (!state.filters.search) {
            state.filters.search = {
              query: '',
              fields: ['name', 'email', 'phone', 'school'],
            }
          }
          state.filters.search.query = query
        }),

      setAdvancedFilters: (filters) =>
        set((state) => {
          state.filters.advanced = filters
        }),

      resetFilters: () =>
        set((state) => {
          state.filters = { ...defaultFilters }
          state.selectedFamilyKeys = new Set()
        }),

      // ========================================================================
      // VIEW ACTIONS
      // ========================================================================

      setViewMode: (mode) =>
        set((state) => {
          state.viewMode = mode
        }),

      setActiveTab: (tab) =>
        set((state) => {
          state.activeTab = tab
          state.filters.tab = tab
        }),

      // ========================================================================
      // DIALOG ACTIONS
      // ========================================================================

      setDialogOpen: (dialog, open) =>
        set((state) => {
          if (dialog === 'delete') {
            state.isDeleteDialogOpen = open
          } else if (dialog === 'linkSubscription') {
            state.isLinkSubscriptionDialogOpen = open
          } else if (dialog === 'advancedFilters') {
            state.showAdvancedFilters = open
          }
        }),

      setLinkSubscriptionDialogData: (parentEmail) =>
        set((state) => {
          state.linkSubscriptionDialogParentEmail = parentEmail
        }),

      // ========================================================================
      // UTILITY ACTIONS
      // ========================================================================

      reset: () =>
        set((state) => {
          state.selectedFamilyKeys = new Set()
          state.viewMode = 'grid'
          state.activeTab = 'overview'
          state.filters = { ...defaultFilters }
          state.showAdvancedFilters = false
          state.isDeleteDialogOpen = false
          state.isLinkSubscriptionDialogOpen = false
          state.linkSubscriptionDialogParentEmail = null
        }),
    })),
    {
      name: 'dugsi-ui-store',
    }
  )
)

// ============================================================================
// SELECTORS
// ============================================================================

export const useSelectedFamilies = () =>
  useDugsiUIStore((state) => state.selectedFamilyKeys)
export const useViewMode = () => useDugsiUIStore((state) => state.viewMode)
export const useActiveTab = () => useDugsiUIStore((state) => state.activeTab)
export const useDugsiFilters = () => useDugsiUIStore((state) => state.filters)

// Separate selectors for each dialog type (avoids conditional hooks)
export const useDeleteDialogState = () =>
  useDugsiUIStore((state) => state.isDeleteDialogOpen)
export const useLinkSubscriptionDialogState = () =>
  useDugsiUIStore((state) => state.isLinkSubscriptionDialogOpen)
export const useAdvancedFiltersState = () =>
  useDugsiUIStore((state) => state.showAdvancedFilters)
export const useLinkSubscriptionDialogData = () =>
  useDugsiUIStore((state) => state.linkSubscriptionDialogParentEmail)

// ============================================================================
// LEGACY ACTION COMPATIBILITY (For gradual migration)
// ============================================================================

/**
 * These provide backward compatibility with old action names.
 * Components can be migrated gradually to use the new simplified actions.
 */
export const useLegacyActions = () => {
  const store = useDugsiUIStore()
  return {
    // Selection actions
    toggleFamily: (key: string) => store.toggleFamilySelection(key),
    selectFamily: (key: string) => store.toggleFamilySelection(key),
    deselectFamily: (key: string) => store.toggleFamilySelection(key),
    selectAllFamilies: (keys: string[]) => store.setFamilySelection(keys),
    clearSelection: () => store.clearFamilySelection(),

    // Filter actions
    setSearchQuery: (query: string) => store.setSearchQuery(query),
    setAdvancedFilters: (filters: FamilyFilters) =>
      store.setAdvancedFilters(filters),
    resetFilters: () => store.resetFilters(),

    // View actions
    setViewMode: (mode: ViewMode) => store.setViewMode(mode),
    setActiveTab: (tab: TabValue) => store.setActiveTab(tab),

    // Dialog actions
    setDeleteDialogOpen: (open: boolean) => store.setDialogOpen('delete', open),
    setLinkSubscriptionDialogOpen: (open: boolean) =>
      store.setDialogOpen('linkSubscription', open),
    setAdvancedFiltersOpen: (open: boolean) =>
      store.setDialogOpen('advancedFilters', open),
    setLinkSubscriptionDialogData: (parentEmail: string | null) =>
      store.setLinkSubscriptionDialogData(parentEmail),
  }
}
