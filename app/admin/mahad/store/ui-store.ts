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

import {
  DialogDataFor,
  DialogState,
  DialogType,
  PaymentHealth,
  StudentFilters,
  TabValue,
} from '../_types'

enableMapSet()

interface MahadUIStore {
  activeTab: TabValue
  filters: StudentFilters
  selectedStudentIds: Set<string>
  dialog: DialogState

  setActiveTab: (tab: TabValue) => void
  setFilters: (filters: Partial<StudentFilters>) => void
  setSearchQuery: (query: string) => void
  setBatchFilter: (batchId: string | null) => void
  setPaymentHealthFilter: (paymentHealth: PaymentHealth | null) => void
  resetFilters: () => void
  toggleStudent: (id: string) => void
  setSelected: (ids: string[]) => void
  setSelectedStudentIds: (ids: Set<string>) => void
  clearSelected: () => void
  openDialog: <T extends NonNullable<DialogType>>(
    type: T,
    data: DialogDataFor<T>
  ) => void
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
      dialog: { type: null, data: null },

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

      setSelectedStudentIds: (ids) =>
        set((state) => {
          state.selectedStudentIds = ids
        }),

      clearSelected: () =>
        set((state) => {
          state.selectedStudentIds = new Set()
        }),

      openDialog: (type, data) =>
        set((state) => {
          state.dialog = { type, data } as DialogState
        }),

      closeDialog: () =>
        set((state) => {
          state.dialog = { type: null, data: null }
        }),

      reset: () =>
        set((state) => {
          state.activeTab = 'students'
          state.filters = { ...defaultFilters }
          state.selectedStudentIds = new Set()
          state.dialog = { type: null, data: null }
        }),
    })),
    { name: 'mahad-cohorts-ui-store' }
  )
)

export const useActiveTab = () => useMahadUIStore((s) => s.activeTab)
export const useMahadFilters = () => useMahadUIStore((s) => s.filters)
export const useSelectedStudents = () =>
  useMahadUIStore((s) => s.selectedStudentIds)
export const useDialog = () => useMahadUIStore((s) => s.dialog)
export const useDialogType = () => useMahadUIStore((s) => s.dialog.type)
export const useDialogData = () => useMahadUIStore((s) => s.dialog.data)
