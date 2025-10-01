'use client'

import { UserX } from 'lucide-react'

import { Button } from '@/components/ui/button'

// For now, we'll keep this as a placeholder since the original component is complex
// This would be implemented in a later phase
export function DeleteStudentSheet() {
  return (
    <Button variant="outline" size="sm" className="w-full sm:w-auto" disabled>
      <UserX className="mr-2 h-4 w-4" />
      <span className="hidden sm:inline">Delete Student</span>
      <span className="sm:hidden">Delete</span>
    </Button>
  )
}
