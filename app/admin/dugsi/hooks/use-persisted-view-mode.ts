/**
 * Hook to persist view mode preference to localStorage
 */
'use client'

import { useEffect } from 'react'

import { ViewMode } from '../_types'
import { useViewMode, useLegacyActions } from '../store'

const STORAGE_KEY = 'dugsi-view-mode'

export function usePersistedViewMode() {
  const viewMode = useViewMode()
  const { setViewMode } = useLegacyActions()

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'grid' || saved === 'table') {
      setViewMode(saved as ViewMode)
    }
  }, [setViewMode])

  // Save to localStorage when viewMode changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode)
  }, [viewMode])
}
