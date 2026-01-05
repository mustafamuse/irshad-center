'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'teacher-checkin-onboarding-seen'

export function useCheckinOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const hasSeen = localStorage.getItem(STORAGE_KEY)
    if (!hasSeen) {
      setShowOnboarding(true)
    }
    setIsLoaded(true)
  }, [])

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setShowOnboarding(false)
  }, [])

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setShowOnboarding(true)
  }, [])

  return { showOnboarding, dismissOnboarding, resetOnboarding, isLoaded }
}
