'use client'

import { useEffect } from 'react'

import { useTheme } from 'next-themes'

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme('light')
  }, [setTheme])

  return <>{children}</>
}
