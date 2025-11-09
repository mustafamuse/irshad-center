/**
 * Generic keyboard shortcuts hook for admin dashboards
 * Provides quick navigation and actions via keyboard
 */
'use client'

import { useHotkeys } from 'react-hotkeys-hook'
import { useRouter } from 'next/navigation'

interface UseKeyboardShortcutsOptions {
  onTabChange?: (tab: string) => void
  onOpenCommandPalette?: () => void
  onExportCSV?: () => void
  onSearch?: () => void
  customShortcuts?: {
    key: string
    handler: () => void
  }[]
}

export function useAdminKeyboardShortcuts({
  onTabChange,
  onOpenCommandPalette,
  onExportCSV,
  onSearch,
  customShortcuts = [],
}: UseKeyboardShortcutsOptions = {}) {
  const router = useRouter()

  // Global navigation shortcuts
  // Alt + B - Go to Billing
  useHotkeys(
    'alt+b',
    (e) => {
      e.preventDefault()
      router.push('/admin/billing/overview')
    },
    []
  )

  // Alt + S - Go to Students
  useHotkeys(
    'alt+s',
    (e) => {
      e.preventDefault()
      router.push('/admin/students/mahad')
    },
    []
  )

  // Alt + C - Go to Cohorts
  useHotkeys(
    'alt+c',
    (e) => {
      e.preventDefault()
      router.push('/admin/cohorts')
    },
    []
  )

  // Alt + D - Go to Dugsi (family management)
  useHotkeys(
    'alt+d',
    (e) => {
      e.preventDefault()
      router.push('/admin/dugsi')
    },
    []
  )

  // Cmd/Ctrl + K - Open command palette or search
  useHotkeys(
    'mod+k',
    (e) => {
      e.preventDefault()
      if (onOpenCommandPalette) {
        onOpenCommandPalette()
      } else if (onSearch) {
        onSearch()
      }
    },
    [onOpenCommandPalette, onSearch]
  )

  // Tab navigation shortcuts (1-9)
  const tabKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  const tabNames = ['overview', 'needs-attention', 'active', 'all', 'past-due', 'no-subscription', 'batches', 'duplicates', 'settings']

  tabKeys.forEach((key, index) => {
    useHotkeys(
      key,
      (e) => {
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          e.preventDefault()
          onTabChange?.(tabNames[index] || `tab-${key}`)
        }
      },
      [onTabChange]
    )
  })

  // Cmd/Ctrl + E - Export to CSV
  useHotkeys(
    'mod+e',
    (e) => {
      e.preventDefault()
      onExportCSV?.()
    },
    [onExportCSV]
  )

  // / - Focus search
  useHotkeys(
    '/',
    (e) => {
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        onSearch?.()
      }
    },
    [onSearch]
  )

  // ? - Show keyboard shortcuts help
  useHotkeys(
    'shift+/',
    (e) => {
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        // TODO: Show keyboard shortcuts dialog
        alert(`Keyboard Shortcuts:

Navigation:
  Alt+B - Go to Billing
  Alt+S - Go to Students
  Alt+C - Go to Cohorts
  Alt+D - Go to Dugsi

Tab Navigation:
  1-9 - Switch between tabs

Actions:
  Cmd/Ctrl+K - Search/Command
  Cmd/Ctrl+E - Export CSV
  / - Focus search
  ? - Show this help`)
      }
    },
    []
  )

  // Register custom shortcuts
  customShortcuts.forEach(({ key, handler }) => {
    useHotkeys(key, (e) => {
      e.preventDefault()
      handler()
    })
  })

  return {
    registerShortcut: (key: string, handler: () => void) => {
      useHotkeys(key, (e) => {
        e.preventDefault()
        handler()
      })
    }
  }
}

/**
 * Helper component to display keyboard shortcut hints
 */
export function KeyboardShortcutHint({ shortcut, description }: { shortcut: string; description: string }) {
  // Format the shortcut for display
  const formattedShortcut = shortcut
    .replace('mod', '⌘/Ctrl')
    .replace('alt', 'Alt')
    .replace('shift', '⇧')
    .replace('+', ' + ')

  return (
    <span className="text-xs text-muted-foreground">
      <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded">{formattedShortcut}</kbd>
      <span className="ml-1">{description}</span>
    </span>
  )
}