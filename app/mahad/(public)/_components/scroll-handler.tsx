'use client'

import { useEffect } from 'react'

import { handleHashScroll } from '@/lib/utils/scroll'

export function ScrollHandler() {
  useEffect(() => {
    // Handle scroll to announcement section if URL has #announcements
    const cleanup = handleHashScroll(80) // 80px offset to account for fixed header
    return cleanup
  }, [])

  return null
}
