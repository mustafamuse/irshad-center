'use client'

import { useState, useEffect } from 'react'

import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useEnrollment } from '@/contexts/enrollment-context'
import { useStudentSelection } from '@/hooks/use-student-selection'

import { EmptySelection } from './empty-selection'
import { StudentCard } from './student-card'
import { StudentSearchCombobox } from './student-search-combobox'
import { EnrollmentStepsProgress } from '../(enrollment)/enrollment-steps-progress'
import { EnrollmentSummary } from '../(enrollment)/enrollment-summary'
import { useEligibleStudents } from '../hooks/use-eligible-students'

export function StudentSelectionStep() {
  const [open, setOpen] = useState(false)
  const { data: students, isLoading, error } = useEligibleStudents()
  const {
    state: { selectedStudents, isProcessing },
    actions: { nextStep, updateSelectedStudents },
  } = useEnrollment()

  const { handleStudentSelect, handleStudentRemove, isStudentSelected } =
    useStudentSelection({ selectedStudents, updateSelectedStudents })

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Open search with CMD/CTRL + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      // Close search with ESC
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [open])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Submit clicked in StudentSelectionStep', {
      selectedStudents,
      selectedStudentsLength: selectedStudents.length,
      isProcessing,
    })
    if (selectedStudents.length > 0) {
      console.log('Calling nextStep from StudentSelectionStep')
      nextStep()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <EnrollmentStepsProgress currentStep={0} />
      <Card className="mt-4 border-border bg-card/30 backdrop-blur-sm sm:mt-6">
        <CardHeader className="space-y-2 p-4 sm:p-6">
          <CardTitle className="text-xl font-semibold text-foreground sm:text-2xl">
            Select Your Name
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground sm:text-base">
            Choose the students you want to enroll in the mahad autopay system.
            Press{' '}
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>{' '}
            to search.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
          <div className="relative">
            <StudentSearchCombobox
              students={students || []}
              isLoading={isLoading}
              error={error?.message || null}
              open={open}
              onOpenChange={setOpen}
              onSelect={handleStudentSelect}
              isStudentSelected={isStudentSelected}
            />
          </div>

          <div className="space-y-4">
            {selectedStudents.length === 0 ? (
              <EmptySelection />
            ) : (
              <AnimatePresence mode="popLayout">
                {selectedStudents.map((student) => (
                  <motion.div
                    key={student.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <StudentCard
                      student={student}
                      onRemove={handleStudentRemove}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900/50 p-6">
            <EnrollmentSummary selectedStudents={selectedStudents} />
          </div>
        </CardContent>

        <CardFooter className="border-t border-border p-4 sm:p-6">
          <Button
            className="h-12 w-full text-base"
            type="button"
            disabled={selectedStudents.length === 0 || isProcessing}
            onClick={onSubmit}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Continue to Payment Details'
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
