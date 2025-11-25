'use client'

import { useState } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'

import { ErrorBoundary } from './_components/error-boundary'

export function Providers({ children }: { children: React.ReactNode }) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/dd387a56-ba45-49fb-a265-e15472772648', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'providers.tsx:12',
      message: 'Providers component render start',
      data: { hasChildren: !!children },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'A',
    }),
  }).catch(() => {})
  // #endregion

  const [queryClient] = useState(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/dd387a56-ba45-49fb-a265-e15472772648', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'providers.tsx:14',
        message: 'QueryClient initialization',
        data: {},
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'D',
      }),
    }).catch(() => {})
    // #endregion
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60, // 1 minute
          refetchOnWindowFocus: true,
        },
      },
    })
  })

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/dd387a56-ba45-49fb-a265-e15472772648', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'providers.tsx:28',
      message: 'Before Toaster render',
      data: { hasQueryClient: !!queryClient },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'A,B',
    }),
  }).catch(() => {})
  // #endregion

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {children}
        {/* #region agent log */}
        {(() => {
          fetch(
            'http://127.0.0.1:7242/ingest/dd387a56-ba45-49fb-a265-e15472772648',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'providers.tsx:32',
                message: 'Rendering Toaster component',
                data: { position: 'top-center' },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'A,B',
              }),
            }
          ).catch(() => {})
          return null
        })()}
        {/* #endregion */}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'white',
              color: '#374151',
              border: '1px solid #e5e7eb',
            },
          }}
        />
        <ReactQueryDevtools initialIsOpen={false} />
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
