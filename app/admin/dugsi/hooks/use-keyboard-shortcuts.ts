/**
 * Provides keyboard shortcuts for dugsi admin dashboard
 */
'use client'

import { useRef } from 'react'

import { useHotkeys } from 'react-hotkeys-hook'

import { useLegacyActions } from '../store'

interface UseKeyboardShortcutsOptions {
  onOpenCommandPalette?: () => void
}

export function useKeyboardShortcuts({
  onOpenCommandPalette,
}: UseKeyboardShortcutsOptions = {}) {
  const { clearSelection } = useLegacyActions()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Cmd/Ctrl + K - Open command palette
  useHotkeys(
    'mod+k',
    (e) => {
      e.preventDefault()
      onOpenCommandPalette?.()
    },
    [onOpenCommandPalette]
  )

  // / - Focus search
  useHotkeys(
    '/',
    (e) => {
      // Only if not already in an input
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    },
    [searchInputRef]
  )

  // Escape - Clear selection
  useHotkeys(
    'escape',
    () => {
      clearSelection()
    },
    [clearSelection]
  )

  return { searchInputRef }
}
