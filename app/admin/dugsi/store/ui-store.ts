import { Shift } from '@prisma/client'
import { enableMapSet } from 'immer'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { FamilyFilters, TabValue, SearchField } from '../_types'

enableMapSet()

// ============================================================================
// TYPES
// ============================================================================

export interface DugsiFilters {
  search?: {
    query: string
    field: SearchField
  }
  advanced?: FamilyFilters
  tab?: TabValue
  quickShift?: Shift | null
}

interface DugsiUIStore {
  // ============================================================================
  // STATE
  // ============================================================================
  activeTab: TabValue
  filters: DugsiFilters
  showAdvancedFilters: boolean
  isVerifyBankDialogOpen: boolean
  verifyBankDialogData: {
    paymentIntentId: string
    parentEmail: string
  } | null
  selectedFamilyIds: Set<string>

  // ============================================================================
  // CORE ACTIONS
  // ============================================================================

  // Filter actions
  updateFilters: (updates: Partial<DugsiFilters>) => void
  setSearchQuery: (query: string) => void
  setSearchField: (field: SearchField) => void
  setAdvancedFilters: (filters: FamilyFilters) => void
  setQuickShiftFilter: (shift: Shift | null) => void
  resetFilters: () => void

  // View actions
  setActiveTab: (tab: TabValue) => void

  // Selection actions
  setSelectedFamilyIds: (ids: Set<string>) => void
  toggleFamilySelection: (familyKey: string) => void
  selectAllFamilies: (familyKeys: string[]) => void
  clearSelection: () => void

  // Dialog actions
  setDialogOpen: (
    dialog: 'advancedFilters' | 'verifyBank',
    open: boolean
  ) => void
  setVerifyBankDialogData: (
    data: {
      paymentIntentId: string
      parentEmail: string
    } | null
  ) => void

  // Utility actions
  reset: () => void
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const defaultFilters: DugsiFilters = {
  search: {
    query: '',
    field: 'all',
  },
  advanced: {
    dateFilter: 'all',
    hasHealthInfo: false,
  },
  tab: 'all',
  quickShift: null,
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useDugsiUIStore = create<DugsiUIStore>()(
  devtools(
    immer((set) => ({
      activeTab: 'all',
      filters: defaultFilters,
      showAdvancedFilters: false,
      isVerifyBankDialogOpen: false,
      verifyBankDialogData: null,
      selectedFamilyIds: new Set<string>(),

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
            state.filters.search = { query: '', field: 'all' }
          }
          state.filters.search.query = query
        }),

      setSearchField: (field) =>
        set((state) => {
          if (!state.filters.search) {
            state.filters.search = { query: '', field: 'all' }
          }
          state.filters.search.field = field
        }),

      setAdvancedFilters: (filters) =>
        set((state) => {
          state.filters.advanced = filters
        }),

      setQuickShiftFilter: (shift) =>
        set((state) => {
          state.filters.quickShift = shift
        }),

      resetFilters: () =>
        set((state) => {
          state.filters = { ...defaultFilters }
        }),

      // ========================================================================
      // VIEW ACTIONS
      // ========================================================================

      setActiveTab: (tab) =>
        set((state) => {
          state.activeTab = tab
          state.filters.tab = tab
        }),

      // ========================================================================
      // SELECTION ACTIONS
      // ========================================================================

      setSelectedFamilyIds: (ids) =>
        set((state) => {
          state.selectedFamilyIds = ids
        }),

      toggleFamilySelection: (familyKey) =>
        set((state) => {
          if (state.selectedFamilyIds.has(familyKey)) {
            state.selectedFamilyIds.delete(familyKey)
          } else {
            state.selectedFamilyIds.add(familyKey)
          }
        }),

      selectAllFamilies: (familyKeys) =>
        set((state) => {
          state.selectedFamilyIds = new Set(familyKeys)
        }),

      clearSelection: () =>
        set((state) => {
          state.selectedFamilyIds = new Set()
        }),

      // ========================================================================
      // DIALOG ACTIONS
      // ========================================================================

      setDialogOpen: (dialog, open) =>
        set((state) => {
          if (dialog === 'advancedFilters') {
            state.showAdvancedFilters = open
          } else if (dialog === 'verifyBank') {
            state.isVerifyBankDialogOpen = open
          }
        }),

      setVerifyBankDialogData: (data) =>
        set((state) => {
          state.verifyBankDialogData = data
        }),

      // ========================================================================
      // UTILITY ACTIONS
      // ========================================================================

      reset: () =>
        set((state) => {
          state.activeTab = 'all'
          state.filters = { ...defaultFilters }
          state.showAdvancedFilters = false
          state.isVerifyBankDialogOpen = false
          state.verifyBankDialogData = null
          state.selectedFamilyIds = new Set()
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

export const useActiveTab = () => useDugsiUIStore((state) => state.activeTab)
export const useDugsiFilters = () => useDugsiUIStore((state) => state.filters)
export const useSelectedFamilyIds = () =>
  useDugsiUIStore((state) => state.selectedFamilyIds)
export const useQuickShiftFilter = () =>
  useDugsiUIStore((state) => state.filters.quickShift)
export const useAdvancedFiltersState = () =>
  useDugsiUIStore((state) => state.showAdvancedFilters)

export const useSearchQuery = () =>
  useDugsiUIStore((state) => state.filters.search?.query ?? '')
export const useSearchField = () =>
  useDugsiUIStore((state) => state.filters.search?.field ?? 'all')
export const useAdvancedFilters = () =>
  useDugsiUIStore((state) => state.filters.advanced)
export const useTabFilter = () =>
  useDugsiUIStore((state) => state.filters.tab ?? 'all')

// ============================================================================
// FILTER ACTIONS
// ============================================================================

export const useFilterActions = () => {
  const store = useDugsiUIStore()
  return {
    setSearchQuery: (query: string) => store.setSearchQuery(query),
    setSearchField: (field: SearchField) => store.setSearchField(field),
    setAdvancedFilters: (filters: FamilyFilters) =>
      store.setAdvancedFilters(filters),
    resetFilters: () => store.resetFilters(),
    setActiveTab: (tab: TabValue) => store.setActiveTab(tab),
    setAdvancedFiltersOpen: (open: boolean) =>
      store.setDialogOpen('advancedFilters', open),
  }
}
