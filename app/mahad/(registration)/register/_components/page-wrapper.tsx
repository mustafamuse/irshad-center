'use client'

import { useEffect } from 'react'

import { useTheme } from 'next-themes'

export function PageWrapper({ children }: { children: React.ReactNode }) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/dd387a56-ba45-49fb-a265-e15472772648', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'page-wrapper.tsx:8',
      message: 'PageWrapper render start',
      data: {},
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'C',
    }),
  }).catch(() => {})
  // #endregion

  const { setTheme } = useTheme()

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/dd387a56-ba45-49fb-a265-e15472772648', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'page-wrapper.tsx:13',
        message: 'PageWrapper useEffect - calling setTheme',
        data: { theme: 'light' },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'C',
      }),
    }).catch(() => {})
    // #endregion
    setTheme('light')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // setTheme is stable and doesn't need to be in dependencies

  return <>{children}</>
}
