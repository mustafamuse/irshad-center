'use client'

import { useEffect, useCallback } from 'react'

interface UseTabKeyboardShortcutsOptions<T extends string> {
  tabs: readonly T[]
  currentTab: T
  onTabChange: (tab: T) => void
  enabled?: boolean
}

export function useTabKeyboardShortcuts<T extends string>({
  tabs,
  currentTab,
  onTabChange,
  enabled = true,
}: UseTabKeyboardShortcutsOptions<T>) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }

      const key = event.key
      if (key >= '1' && key <= '9') {
        const index = parseInt(key, 10) - 1
        if (index < tabs.length) {
          event.preventDefault()
          onTabChange(tabs[index])
        }
      }
    },
    [tabs, onTabChange, enabled]
  )

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])

  return { currentTab }
}
