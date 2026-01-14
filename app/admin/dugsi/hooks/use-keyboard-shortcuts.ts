/**
 * Provides keyboard shortcuts for dugsi admin dashboard
 */
'use client'

import { useRef } from 'react'

import { useHotkeys } from 'react-hotkeys-hook'

import { TabValue } from '../_types'

interface UseKeyboardShortcutsOptions {
  onOpenCommandPalette?: () => void
  onSetActiveTab?: (tab: TabValue) => void
  onClearSelection?: () => void
  onCloseSheet?: () => void
  onSelectAll?: () => void
  onExport?: () => void
}

export function useKeyboardShortcuts({
  onOpenCommandPalette,
  onSetActiveTab,
  onClearSelection,
  onCloseSheet,
  onSelectAll,
  onExport,
}: UseKeyboardShortcutsOptions = {}) {
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

  // 1-5 - Switch tabs
  useHotkeys(
    '1',
    (e) => {
      if (document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        onSetActiveTab?.('active')
      }
    },
    [onSetActiveTab]
  )

  useHotkeys(
    '2',
    (e) => {
      if (document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        onSetActiveTab?.('churned')
      }
    },
    [onSetActiveTab]
  )

  useHotkeys(
    '3',
    (e) => {
      if (document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        onSetActiveTab?.('needs-attention')
      }
    },
    [onSetActiveTab]
  )

  useHotkeys(
    '4',
    (e) => {
      if (document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        onSetActiveTab?.('billing-mismatch')
      }
    },
    [onSetActiveTab]
  )

  useHotkeys(
    '5',
    (e) => {
      if (document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        onSetActiveTab?.('all')
      }
    },
    [onSetActiveTab]
  )

  // Escape - Clear selection / close sheet
  useHotkeys(
    'escape',
    () => {
      onClearSelection?.()
      onCloseSheet?.()
    },
    [onClearSelection, onCloseSheet]
  )

  // Cmd/Ctrl + A - Select all (when not in input)
  useHotkeys(
    'mod+a',
    (e) => {
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        onSelectAll?.()
      }
    },
    [onSelectAll]
  )

  // Cmd/Ctrl + E - Export
  useHotkeys(
    'mod+e',
    (e) => {
      e.preventDefault()
      onExport?.()
    },
    [onExport]
  )

  return { searchInputRef }
}
