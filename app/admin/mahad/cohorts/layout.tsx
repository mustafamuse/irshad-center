import { ReactNode } from 'react'

type LayoutProps = {
  children: ReactNode
  modal: ReactNode // Parallel route slot for intercepting routes
}

/**
 * Cohorts Layout with Parallel Routes
 *
 * The @modal slot enables intercepting routes:
 * - Click student in list → Modal opens via @modal/(..)students/[id]
 * - Direct navigation → Full page via students/[id]
 * - Refresh with modal open → Modal persists
 */
export default function CohortsLayout({ children, modal }: LayoutProps) {
  return (
    <>
      {children}
      {modal} {/* Modal renders on top when intercepting route matches */}
    </>
  )
}
