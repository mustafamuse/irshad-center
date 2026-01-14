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
  isDeleteDialogOpen: boolean
  isLinkSubscriptionDialogOpen: boolean
  linkSubscriptionDialogParentEmail: string | null
  isVerifyBankDialogOpen: boolean
  verifyBankDialogData: {
    paymentIntentId: string
    parentEmail: string
  } | null
  isConsolidateSubscriptionDialogOpen: boolean
  consolidateSubscriptionDialogData: {
    familyId: string
    familyName: string
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
    dialog:
      | 'delete'
      | 'linkSubscription'
      | 'advancedFilters'
      | 'verifyBank'
      | 'consolidateSubscription',
    open: boolean
  ) => void
  setLinkSubscriptionDialogData: (parentEmail: string | null) => void
  setVerifyBankDialogData: (
    data: {
      paymentIntentId: string
      parentEmail: string
    } | null
  ) => void
  setConsolidateSubscriptionDialogData: (
    data: {
      familyId: string
      familyName: string
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
      isDeleteDialogOpen: false,
      isLinkSubscriptionDialogOpen: false,
      linkSubscriptionDialogParentEmail: null,
      isVerifyBankDialogOpen: false,
      verifyBankDialogData: null,
      isConsolidateSubscriptionDialogOpen: false,
      consolidateSubscriptionDialogData: null,
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
          if (dialog === 'delete') {
            state.isDeleteDialogOpen = open
          } else if (dialog === 'linkSubscription') {
            state.isLinkSubscriptionDialogOpen = open
          } else if (dialog === 'advancedFilters') {
            state.showAdvancedFilters = open
          } else if (dialog === 'verifyBank') {
            state.isVerifyBankDialogOpen = open
          } else if (dialog === 'consolidateSubscription') {
            state.isConsolidateSubscriptionDialogOpen = open
          }
        }),

      setLinkSubscriptionDialogData: (parentEmail) =>
        set((state) => {
          state.linkSubscriptionDialogParentEmail = parentEmail
        }),

      setVerifyBankDialogData: (data) =>
        set((state) => {
          state.verifyBankDialogData = data
        }),

      setConsolidateSubscriptionDialogData: (data) =>
        set((state) => {
          state.consolidateSubscriptionDialogData = data
        }),

      // ========================================================================
      // UTILITY ACTIONS
      // ========================================================================

      reset: () =>
        set((state) => {
          state.activeTab = 'all'
          state.filters = { ...defaultFilters }
          state.showAdvancedFilters = false
          state.isDeleteDialogOpen = false
          state.isLinkSubscriptionDialogOpen = false
          state.linkSubscriptionDialogParentEmail = null
          state.isVerifyBankDialogOpen = false
          state.verifyBankDialogData = null
          state.isConsolidateSubscriptionDialogOpen = false
          state.consolidateSubscriptionDialogData = null
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

export const useDeleteDialogState = () =>
  useDugsiUIStore((state) => state.isDeleteDialogOpen)
export const useLinkSubscriptionDialogState = () =>
  useDugsiUIStore((state) => state.isLinkSubscriptionDialogOpen)
export const useAdvancedFiltersState = () =>
  useDugsiUIStore((state) => state.showAdvancedFilters)
export const useLinkSubscriptionDialogData = () =>
  useDugsiUIStore((state) => state.linkSubscriptionDialogParentEmail)
export const useConsolidateSubscriptionDialogState = () =>
  useDugsiUIStore((state) => state.isConsolidateSubscriptionDialogOpen)
export const useConsolidateSubscriptionDialogData = () =>
  useDugsiUIStore((state) => state.consolidateSubscriptionDialogData)

// ============================================================================
// LEGACY ACTION COMPATIBILITY (For gradual migration)
// ============================================================================

export const useLegacyActions = () => {
  const store = useDugsiUIStore()
  return {
    setSearchQuery: (query: string) => store.setSearchQuery(query),
    setSearchField: (field: SearchField) => store.setSearchField(field),
    setAdvancedFilters: (filters: FamilyFilters) =>
      store.setAdvancedFilters(filters),
    resetFilters: () => store.resetFilters(),

    setActiveTab: (tab: TabValue) => store.setActiveTab(tab),

    setDeleteDialogOpen: (open: boolean) => store.setDialogOpen('delete', open),
    setLinkSubscriptionDialogOpen: (open: boolean) =>
      store.setDialogOpen('linkSubscription', open),
    setAdvancedFiltersOpen: (open: boolean) =>
      store.setDialogOpen('advancedFilters', open),
    setLinkSubscriptionDialogData: (parentEmail: string | null) =>
      store.setLinkSubscriptionDialogData(parentEmail),
  }
}
