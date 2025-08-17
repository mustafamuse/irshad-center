'use client'

import { useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  UserPlus,
  ArrowRightLeft,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  assignStudentsToBatch,
  transferStudentsToBatch,
} from '@/lib/actions/batch-actions'
import { cn } from '@/lib/utils'

import { useBatchData } from '../hooks/use-batch-data'
import { useBatches } from '../hooks/use-batches'

interface AssignStudentsDialogProps {
  children?: React.ReactNode
}

export function AssignStudentsDialog({ children }: AssignStudentsDialogProps) {
  const [mode, setMode] = useState<'assign' | 'transfer'>('assign')
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [destinationBatchId, setDestinationBatchId] = useState<string | null>(
    null
  )
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
    new Set()
  )
  const [sourceSearch, setSourceSearch] = useState('')
  const [destinationSearch, setDestinationSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferProgress, setTransferProgress] = useState(0)
  const [transferStatus, setTransferStatus] = useState('')

  const queryClient = useQueryClient()
  const {
    data: batches = [],
    isLoading: batchesLoading,
    error: _batchesError,
    invalidateBatches,
  } = useBatches()
  const { data: students = [] } = useBatchData()

  const handleRefreshBatches = async () => {
    try {
      await invalidateBatches()
      toast.success('Batches refreshed')
    } catch {
      toast.error('Failed to refresh batches')
    }
  }

  // Debug logging for batch data
  console.log('🔍 AssignStudents Debug:', {
    batchesLoading,
    batchesError: _batchesError,
    batchCount: batches.length,
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      studentCount: b.studentCount,
    })),
  })

  // Update the student filtering logic
  const sourceStudents =
    mode === 'assign'
      ? students.filter((s) => !s.batch) // Unassigned students for assign mode
      : students.filter((s) => s.batch?.id === selectedBatch) // Students from source batch for transfer mode

  // Update destination students logic
  const destinationStudents =
    mode === 'assign'
      ? students.filter((s) => s.batch?.id === selectedBatch) // Show selected batch students in assign mode
      : students.filter((s) => s.batch?.id === destinationBatchId) // Show destination batch students in transfer mode

  // Apply search filters
  const filteredSourceStudents = sourceStudents.filter((s) =>
    sourceSearch
      ? s.name.toLowerCase().includes(sourceSearch.toLowerCase())
      : true
  )

  const filteredDestinationStudents = destinationStudents.filter((s) =>
    destinationSearch
      ? s.name.toLowerCase().includes(destinationSearch.toLowerCase())
      : true
  )

  function handleModeChange(newMode: 'assign' | 'transfer') {
    setMode(newMode)
    setSelectedStudents(new Set())
    setSelectedBatch(null)
    setSourceSearch('')
    setDestinationSearch('')
    setDestinationBatchId(null)
  }

  function toggleStudent(studentId: string) {
    setSelectedStudents((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      return next
    })
  }

  async function handleAction() {
    if (!selectedBatch || selectedStudents.size === 0) return
    if (mode === 'transfer' && !destinationBatchId) return

    setIsLoading(true)
    if (mode === 'transfer') {
      setIsTransferring(true)
      setTransferProgress(0)
      setTransferStatus('Starting transfer...')
    }

    try {
      if (mode === 'assign') {
        const result = await assignStudentsToBatch(
          selectedBatch,
          Array.from(selectedStudents)
        )
        if (result.success) {
          toast.success('Students assigned successfully')
        }
      } else {
        // Transfer mode with progress
        const selectedStudentsArray = Array.from(selectedStudents)
        setTransferStatus('Transferring students...')

        const result = await transferStudentsToBatch(
          destinationBatchId!,
          selectedStudentsArray
        )

        if (result.success) {
          setTransferProgress(100)
          setTransferStatus('Transfer complete!')
          toast.success(`${result.count} students transferred successfully`)
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
      ])

      setSelectedStudents(new Set())
    } catch (error) {
      console.error('Action error:', error)
      setTransferStatus('Transfer failed')
      toast.error(
        error instanceof Error ? error.message : 'Failed to transfer students'
      )
    } finally {
      setIsLoading(false)
      setIsTransferring(false)
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <DropdownMenuItem>
            <UserPlus className="mr-2 h-4 w-4" />
            Manage Students
          </DropdownMenuItem>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-[900px]"
      >
        <SheetHeader className="px-1">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Manage Batch Students</SheetTitle>
              <SheetDescription>
                Assign new students or transfer existing students between
                batches
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshBatches}
              disabled={batchesLoading}
              title="Refresh batch list"
            >
              <RefreshCw
                className={`h-4 w-4 ${batchesLoading ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4 pb-8 sm:mt-6 sm:gap-6">
          <Tabs
            defaultValue="assign"
            onValueChange={(value) =>
              handleModeChange(value as 'assign' | 'transfer')
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="assign" className="text-sm">
                <span className="hidden sm:inline">Assign New Students</span>
                <span className="sm:hidden">Assign</span>
              </TabsTrigger>
              <TabsTrigger value="transfer" className="text-sm">
                <span className="hidden sm:inline">Transfer Students</span>
                <span className="sm:hidden">Transfer</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <Select
                value={selectedBatch ?? ''}
                onValueChange={setSelectedBatch}
                disabled={batchesLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      batchesLoading
                        ? 'Loading batches...'
                        : mode === 'assign'
                          ? 'Choose destination batch'
                          : 'Choose source batch'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {batchesLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Loading batches...
                    </div>
                  ) : _batchesError ? (
                    <div className="py-6 text-center text-sm text-destructive">
                      Error loading batches
                    </div>
                  ) : batches.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No batches available
                    </div>
                  ) : (
                    batches
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name} ({batch.studentCount})
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {mode === 'transfer' && selectedBatch && (
              <div className="mt-2">
                <Select
                  value={destinationBatchId ?? ''}
                  onValueChange={setDestinationBatchId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose destination batch" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {batches.filter((b) => b.id !== selectedBatch).length ===
                    0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No destination batches available
                      </div>
                    ) : (
                      batches
                        .filter((b) => b.id !== selectedBatch)
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.name} ({batch.studentCount})
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
              {/* Source Students */}
              <div className="flex h-[300px] flex-col sm:h-[400px]">
                <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-medium sm:text-base">
                    {mode === 'assign' ? (
                      'Available Students'
                    ) : (
                      <>
                        Students in{' '}
                        <span className="block sm:inline">
                          {batches.find((b) => b.id === selectedBatch)?.name ??
                            'Source Batch'}
                        </span>
                      </>
                    )}
                  </h3>
                  <Input
                    placeholder="Search..."
                    className="w-full sm:w-[200px]"
                    value={sourceSearch}
                    onChange={(e) => setSourceSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="flex-1 rounded-md border">
                  <div className="space-y-2 p-4">
                    {filteredSourceStudents.map((student) => (
                      <Card
                        key={student.id}
                        className={cn(
                          'cursor-pointer p-3 hover:bg-accent',
                          selectedStudents.has(student.id) && 'border-primary'
                        )}
                        onClick={() => toggleStudent(student.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedStudents.has(student.id)}
                          />
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {student.status}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Destination Students */}
              <div className="flex h-[300px] flex-col sm:h-[400px]">
                <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-medium sm:text-base">
                    {mode === 'assign' ? (
                      <>
                        Students in{' '}
                        <span className="block sm:inline">
                          {batches.find((b) => b.id === selectedBatch)?.name ??
                            'Batch'}
                        </span>
                      </>
                    ) : (
                      <>
                        Students in{' '}
                        <span className="block sm:inline">
                          {batches.find((b) => b.id === destinationBatchId)
                            ?.name ?? 'Destination Batch'}
                        </span>
                      </>
                    )}
                  </h3>
                  <Input
                    placeholder="Search..."
                    className="w-full sm:w-[200px]"
                    value={destinationSearch}
                    onChange={(e) => setDestinationSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="flex-1 rounded-md border">
                  <div className="space-y-2 p-4">
                    {filteredDestinationStudents.map((student) => (
                      <Card key={student.id} className="p-3">
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {student.status}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Add Transfer Progress */}
            {mode === 'transfer' && isTransferring && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {transferStatus}
                  </p>
                  <p className="text-sm font-medium">{transferProgress}%</p>
                </div>
                <Progress value={transferProgress} className="h-2" />
              </div>
            )}

            <Button
              onClick={handleAction}
              disabled={
                !selectedBatch ||
                selectedStudents.size === 0 ||
                isLoading ||
                (mode === 'transfer' && !destinationBatchId)
              }
              className="mt-4 w-full sm:mt-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isTransferring ? 'Transferring...' : 'Processing...'}
                </>
              ) : (
                <>
                  {mode === 'transfer' ? (
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {mode === 'assign' ? 'Assign' : 'Transfer'}{' '}
                  {selectedStudents.size} Student
                  {selectedStudents.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
