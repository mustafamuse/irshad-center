/**
 * Simplified UI Store for Mahad Cohorts Management
 *
 * Manages transient UI state:
 * - Active tab
 * - Student filters (search, batch, status)
 * - Student selection for bulk operations
 * - Dialog visibility
 *
 * Follows the Dugsi admin pattern for consistency.
 */

import { enableMapSet } from 'immer'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { DialogType, PaymentHealth, StudentFilters, TabValue } from '../_types'

enableMapSet()

interface MahadUIStore {
  activeTab: TabValue
  filters: StudentFilters
  selectedStudentIds: Set<string>
  openDialog: DialogType
  dialogData: unknown

  setActiveTab: (tab: TabValue) => void
  setFilters: (filters: Partial<StudentFilters>) => void
  setSearchQuery: (query: string) => void
  setBatchFilter: (batchId: string | null) => void
  setPaymentHealthFilter: (paymentHealth: PaymentHealth | null) => void
  resetFilters: () => void
  toggleStudent: (id: string) => void
  setSelected: (ids: string[]) => void
  clearSelected: () => void
  openDialogWithData: (dialog: DialogType, data?: unknown) => void
  closeDialog: () => void
  reset: () => void
}

const defaultFilters: StudentFilters = {
  search: '',
  batchId: null,
  paymentHealth: null,
}

export const useMahadUIStore = create<MahadUIStore>()(
  devtools(
    immer((set) => ({
      activeTab: 'students',
      filters: defaultFilters,
      selectedStudentIds: new Set(),
      openDialog: null,
      dialogData: null,

      setActiveTab: (tab) =>
        set((state) => {
          state.activeTab = tab
        }),

      setFilters: (filters) =>
        set((state) => {
          state.filters = { ...state.filters, ...filters }
        }),

      setSearchQuery: (query) =>
        set((state) => {
          state.filters.search = query
        }),

      setBatchFilter: (batchId) =>
        set((state) => {
          state.filters.batchId = batchId
        }),

      setPaymentHealthFilter: (paymentHealth) =>
        set((state) => {
          state.filters.paymentHealth = paymentHealth
        }),

      resetFilters: () =>
        set((state) => {
          state.filters = { ...defaultFilters }
        }),

      toggleStudent: (id) =>
        set((state) => {
          if (state.selectedStudentIds.has(id)) {
            state.selectedStudentIds.delete(id)
          } else {
            state.selectedStudentIds.add(id)
          }
        }),

      setSelected: (ids) =>
        set((state) => {
          state.selectedStudentIds = new Set(ids)
        }),

      clearSelected: () =>
        set((state) => {
          state.selectedStudentIds = new Set()
        }),

      openDialogWithData: (dialog, data) =>
        set((state) => {
          state.openDialog = dialog
          state.dialogData = data ?? null
        }),

      closeDialog: () =>
        set((state) => {
          state.openDialog = null
          state.dialogData = null
        }),

      reset: () =>
        set((state) => {
          state.activeTab = 'students'
          state.filters = { ...defaultFilters }
          state.selectedStudentIds = new Set()
          state.openDialog = null
          state.dialogData = null
        }),
    })),
    { name: 'mahad-cohorts-ui-store' }
  )
)

export const useActiveTab = () => useMahadUIStore((s) => s.activeTab)
export const useMahadFilters = () => useMahadUIStore((s) => s.filters)
export const useSelectedStudents = () =>
  useMahadUIStore((s) => s.selectedStudentIds)
export const useDialogState = () => useMahadUIStore((s) => s.openDialog)
export const useDialogData = () => useMahadUIStore((s) => s.dialogData)
