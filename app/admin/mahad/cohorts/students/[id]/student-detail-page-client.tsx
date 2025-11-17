'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import { StudentDetailData, BatchWithCount } from '@/lib/types/batch'

import { StudentDetailsContent } from '../../components/students-table/student-details-content'

interface StudentDetailPageClientProps {
  student: StudentDetailData
  batches: BatchWithCount[]
  initialMode: 'view' | 'edit'
}

export function StudentDetailPageClient({
  student,
  batches,
  initialMode,
}: StudentDetailPageClientProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode)

  const handleModeChange = (newMode: 'view' | 'edit') => {
    setMode(newMode)
    // Update URL to reflect mode change
    const url = new URL(window.location.href)
    if (newMode === 'edit') {
      url.searchParams.set('mode', 'edit')
    } else {
      url.searchParams.delete('mode')
    }
    router.replace(url.pathname + url.search)
  }

  return (
    <StudentDetailsContent
      student={student}
      batches={batches}
      mode={mode}
      onModeChange={handleModeChange}
      showModeToggle={true}
    />
  )
}
