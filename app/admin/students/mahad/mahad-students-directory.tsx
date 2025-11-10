'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Users, UserCheck, UserX, UserPlus } from 'lucide-react'
import type { StudentWithBatch } from '@/lib/db/queries/student'
import type { BatchWithCount } from '@/lib/types/batch'
import { StudentsTable } from '@/app/admin/mahad/cohorts/components/students-table/students-table'

interface MahadStudentsDirectoryProps {
  students: StudentWithBatch[]
  batches: BatchWithCount[]
}

export function MahadStudentsDirectory({
  students,
  batches,
}: MahadStudentsDirectoryProps) {
  const [activeTab, setActiveTab] = useState('all')

  // Calculate student stats
  const stats = {
    total: students.length,
    enrolled: students.filter(s => s.status === 'enrolled').length,
    registered: students.filter(s => s.status === 'registered').length,
    withdrawn: students.filter(s => s.status === 'withdrawn').length,
  }

  // Filter students based on tab
  const getFilteredStudents = () => {
    switch (activeTab) {
      case 'enrolled':
        return students.filter(s => s.status === 'enrolled')
      case 'registered':
        return students.filter(s => s.status === 'registered')
      case 'withdrawn':
        return students.filter(s => s.status === 'withdrawn')
      default:
        return students
    }
  }

  return (
    <div className="space-y-6">
      {/* Student Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Students</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
              <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.enrolled}</p>
              <p className="text-sm text-muted-foreground">Enrolled</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900">
              <UserPlus className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.registered}</p>
              <p className="text-sm text-muted-foreground">Registered</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
              <UserX className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.withdrawn}</p>
              <p className="text-sm text-muted-foreground">Withdrawn</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabbed Student List */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="all" className="gap-2">
            <span className="hidden sm:inline">All</span>
            <Badge variant="secondary" className="ml-1">
              {stats.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="enrolled" className="gap-2">
            <span className="hidden sm:inline">Enrolled</span>
            <Badge variant="secondary" className="ml-1">
              {stats.enrolled}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="registered" className="gap-2">
            <span className="hidden sm:inline">Registered</span>
            <Badge variant="secondary" className="ml-1">
              {stats.registered}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="withdrawn" className="gap-2">
            <span className="hidden sm:inline">Withdrawn</span>
            <Badge variant="secondary" className="ml-1">
              {stats.withdrawn}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <StudentsTable
            students={getFilteredStudents()}
            batches={batches}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}