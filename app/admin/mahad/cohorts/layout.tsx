import { ReactNode } from 'react'

import { Separator } from '@/components/ui/separator'

import { Providers } from '../../../providers'

type LayoutProps = {
  children: ReactNode
  modal: ReactNode // Parallel route slot for intercepting routes
  duplicates: ReactNode // Parallel route slot for duplicate detection
  batches: ReactNode // Parallel route slot for batch management
  students: ReactNode // Parallel route slot for students table
}

/**
 * Cohorts Layout with Parallel Routes
 *
 * This layout orchestrates multiple independent sections:
 * - @duplicates: Duplicate student detection (loads independently)
 * - @batches: Batch management grid (loads independently)
 * - @students: Students table with filtering (loads independently)
 * - @modal: Intercepting routes for student details
 *
 * Benefits:
 * - Each section has its own loading state
 * - Errors in one section don't crash the entire page
 * - Progressive rendering (faster perceived performance)
 * - Students can be interacted with while batches are still loading
 */
export default function CohortsLayout({
  children,
  modal,
  duplicates,
  batches,
  students,
}: LayoutProps) {
  return (
    <Providers>
      <main className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6 lg:space-y-8 lg:p-8">
        {/* Duplicate detection section - loads independently */}
        {duplicates}

        {/* Batch management section - loads independently */}
        {batches}

        <Separator className="my-4 sm:my-6 lg:my-8" />

        {/* Students table section - loads independently */}
        {students}

        {/* Default children (page.tsx) - used for route-specific content */}
        {children}
      </main>

      {/* Modal for student details - rendered outside container for proper overlay positioning */}
      {modal}
    </Providers>
  )
}
