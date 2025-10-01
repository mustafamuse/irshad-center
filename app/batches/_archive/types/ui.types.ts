import { ReactNode } from 'react'

import { LucideIcon } from 'lucide-react'

// Component prop types
export interface BaseComponentProps {
  className?: string
  children?: ReactNode
}

// Table and data display types
export interface TableColumn<T> {
  id: string
  header: string
  accessorKey?: keyof T
  cell?: (item: T) => ReactNode
  sortable?: boolean
  width?: string | number
}

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

// Filter UI types
export interface FilterOption {
  label: string
  value: string
  count?: number
  icon?: LucideIcon
}

export interface FilterGroup {
  id: string
  label: string
  type: 'single' | 'multiple' | 'range' | 'search'
  options?: FilterOption[]
  value?: any
  placeholder?: string
}

// Form types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'number'
  placeholder?: string
  required?: boolean
  options?: Array<{ label: string; value: string }>
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
}

export interface FormErrors {
  [key: string]: string | undefined
}

// Dialog and modal types
export interface DialogProps extends BaseComponentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
}

export interface ConfirmDialogProps extends DialogProps {
  onConfirm: () => void
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

// Loading and error states
export interface LoadingState {
  isLoading: boolean
  loadingText?: string
}

export interface ErrorState {
  hasError: boolean
  error?: Error | string
  retry?: () => void
}

// Toast and notification types
export interface ToastMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
}

// Selection and interaction types
export interface SelectionState<T> {
  selectedItems: Set<T>
  isAllSelected: boolean
  isIndeterminate: boolean
  onSelectItem: (item: T) => void
  onSelectAll: () => void
  onClearSelection: () => void
}

// Virtual scrolling types
export interface VirtualListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  itemHeight: number
  containerHeight: number
  overscan?: number
}

// Theme and styling types
export interface ThemeVariant {
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
  muted: string
  border: string
}

// Animation and transition types
export interface AnimationProps {
  initial?: any
  animate?: any
  exit?: any
  transition?: any
}
