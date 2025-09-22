'use client'

import { useState } from 'react'

import { useBatches, useBatchStore } from '@/app/batches/_store/batch.store'
import type { LoadingState, ErrorState } from '@/app/batches/_types'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import AttendanceHistory from './components/attendance-history'
import { AttendanceMarking } from './components/attendance-marking'

export default function AttendancePage() {
  const batches = useBatches()
  const batchesLoading = useBatchStore(
    (state: { batchesLoading: LoadingState }) => state.batchesLoading
  )
  const batchesError = useBatchStore(
    (state: { batchesError: ErrorState }) => state.batchesError
  )
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const [showAttendance, setShowAttendance] = useState(false)

  const handleProceed = () => {
    if (selectedDate && selectedBatchId) {
      setShowAttendance(true)
    }
  }

  if (showAttendance) {
    return (
      <AttendanceMarking
        date={selectedDate!}
        batchId={selectedBatchId}
        onBackAction={() => setShowAttendance(false)}
      />
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
      </div>

      <Tabs defaultValue="mark" className="space-y-6">
        <TabsList>
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
          <TabsTrigger value="history">View History</TabsTrigger>
        </TabsList>

        <TabsContent value="mark" className="space-y-6">
          <p className="text-muted-foreground">
            Select a date and batch to mark attendance
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Select Date</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Select Batch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={selectedBatchId}
                  onValueChange={setSelectedBatchId}
                >
                  <SelectTrigger disabled={batchesLoading.isLoading}>
                    <SelectValue
                      placeholder={
                        batchesLoading.isLoading
                          ? 'Loading batches...'
                          : 'Choose a batch'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {batchesLoading.isLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading batches...
                      </SelectItem>
                    ) : batchesError.hasError ? (
                      <SelectItem value="error" disabled>
                        Failed to load batches
                      </SelectItem>
                    ) : batches.length === 0 ? (
                      <SelectItem value="no-batches" disabled>
                        No batches found
                      </SelectItem>
                    ) : (
                      batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {batchesError.hasError && (
                  <p className="mt-2 text-sm text-red-500">
                    {batchesError.error?.toString() || 'Failed to load batches'}
                  </p>
                )}

                <Button
                  className="w-full"
                  onClick={handleProceed}
                  disabled={!selectedDate || !selectedBatchId}
                >
                  Proceed to Mark Attendance
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <AttendanceHistory />
        </TabsContent>
      </Tabs>
    </div>
  )
}
