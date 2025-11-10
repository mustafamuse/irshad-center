/**
 * Keyboard shortcuts for Mahad admin dashboard
 * Provides quick navigation and actions via keyboard
 */
'use client'

import { useHotkeys } from 'react-hotkeys-hook'

interface UseKeyboardShortcutsOptions {
  onTabChange?: (tab: string) => void
  onOpenCommandPalette?: () => void
  onExportCSV?: () => void
}

export function useKeyboardShortcuts({
  onTabChange,
  onOpenCommandPalette,
  onExportCSV,
}: UseKeyboardShortcutsOptions = {}) {
  // Cmd/Ctrl + K - Open command palette
  useHotkeys(
    'mod+k',
    (e) => {
      e.preventDefault()
      onOpenCommandPalette?.()
    },
    [onOpenCommandPalette]
  )

  // Tab navigation shortcuts (1-5)
  useHotkeys(
    '1',
    (e) => {
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        onTabChange?.('overview')
      }
    },
    [onTabChange]
  )

  useHotkeys(
    '2',
    (e) => {
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        onTabChange?.('needs-attention')
      }
    },
    [onTabChange]
  )

  useHotkeys(
    '3',
    (e) => {
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        onTabChange?.('active')
      }
    },
    [onTabChange]
  )

  useHotkeys(
    '4',
    (e) => {
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        onTabChange?.('all')
      }
    },
    [onTabChange]
  )

  useHotkeys(
    '5',
    (e) => {
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        onTabChange?.('batches')
      }
    },
    [onTabChange]
  )

  // Cmd/Ctrl + E - Export to CSV
  useHotkeys(
    'mod+e',
    (e) => {
      e.preventDefault()
      onExportCSV?.()
    },
    [onExportCSV]
  )

  // ? - Show keyboard shortcuts help (future implementation)
  useHotkeys(
    'shift+/',
    (e) => {
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        // TODO: Show keyboard shortcuts dialog
        console.log('Keyboard shortcuts help')
      }
    },
    []
  )
}
