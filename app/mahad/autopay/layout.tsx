import React from 'react'

export default function AutoPayLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-4 transition-colors sm:px-6 sm:py-8">
      {children}
    </main>
  )
}
