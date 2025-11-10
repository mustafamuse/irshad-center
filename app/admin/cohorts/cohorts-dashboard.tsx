'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GraduationCap,
  Plus,
  Users,
  Calendar,
  ArrowRight,
  Settings,
} from 'lucide-react'
import type { BatchWithCount, BatchStudentData } from '@/lib/types/batch'
import type { StudentWithBatch } from '@/lib/db/queries/student'
import { BatchManagement } from '@/app/admin/mahad/cohorts/components/batch-management/batch-management'
import Link from 'next/link'

interface CohortsDashboardProps {
  batches: BatchWithCount[]
  students: StudentWithBatch[]
}

export function CohortsDashboard({
  batches,
  students,
}: CohortsDashboardProps) {
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)

  // Calculate cohort stats
  const stats = {
    totalBatches: batches.length,
    totalStudents: students.length,
    activeBatches: batches.filter(b => b.studentCount > 0).length,
    unassignedStudents: students.filter(s => !s.batchId).length,
    averageSize: batches.length > 0
      ? Math.round(students.length / batches.filter(b => b.studentCount > 0).length)
      : 0,
  }

  return (
    <div className="space-y-6">
      {/* Cohort Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
              <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalBatches}</p>
              <p className="text-sm text-muted-foreground">Total Cohorts</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalStudents}</p>
              <p className="text-sm text-muted-foreground">Total Students</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
              <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeBatches}</p>
              <p className="text-sm text-muted-foreground">Active Cohorts</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.unassignedStudents}</p>
              <p className="text-sm text-muted-foreground">Unassigned</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
              <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Create New Cohort</h3>
          <p className="text-sm text-muted-foreground">
            Start a new batch for incoming students
          </p>
        </Card>

        <Link href="/admin/students/mahad">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">Manage Students</h3>
            <p className="text-sm text-muted-foreground">
              View and edit student profiles
            </p>
          </Card>
        </Link>

        <Link href="/admin/billing/overview">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
                <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">Payment Status</h3>
            <p className="text-sm text-muted-foreground">
              Check cohort payment health
            </p>
          </Card>
        </Link>
      </div>

      {/* Batch Management Component */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Cohort Organization</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Batch Settings
            </Button>
          </div>
        </div>

        <BatchManagement
          batches={batches}
          students={students as BatchStudentData[]}
        />
      </div>

      {/* Cohort Details Grid */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">All Cohorts</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => {
            const batchStudents = students.filter(s => s.batchId === batch.id)
            return (
              <Card
                key={batch.id}
                className={`p-6 hover:shadow-lg transition-all cursor-pointer ${
                  selectedBatch === batch.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedBatch(batch.id === selectedBatch ? null : batch.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-lg">{batch.name}</h3>
                  <Badge variant={batch.studentCount > 0 ? 'default' : 'secondary'}>
                    {batch.studentCount} students
                  </Badge>
                </div>

                {batch.startDate && (
                  <div className="text-sm text-muted-foreground mb-2">
                    <Calendar className="inline h-3 w-3 mr-1" />
                    Started {new Date(batch.startDate).toLocaleDateString()}
                  </div>
                )}

                <div className="flex justify-between items-center mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      // TODO: Handle batch edit
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      // TODO: Handle view students
                    }}
                  >
                    View Students →
                  </Button>
                </div>

                {/* Expandable Student List Preview */}
                {selectedBatch === batch.id && batchStudents.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Students in this cohort:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {batchStudents.slice(0, 5).map(student => (
                        <div key={student.id} className="text-xs text-muted-foreground">
                          • {student.name}
                        </div>
                      ))}
                      {batchStudents.length > 5 && (
                        <div className="text-xs text-muted-foreground italic">
                          +{batchStudents.length - 5} more...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}

          {/* Add New Cohort Card */}
          <Card className="p-6 border-dashed hover:shadow-lg transition-shadow cursor-pointer bg-muted/20">
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
              <div className="rounded-full bg-primary/10 p-3">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Create New Cohort</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a new batch for students
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Import missing icon
import { AlertCircle, DollarSign } from 'lucide-react'