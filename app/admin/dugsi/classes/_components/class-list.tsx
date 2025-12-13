'use client'

import { useState } from 'react'

import { BookOpen, MoreVertical, Pencil, Users } from 'lucide-react'

import { ShiftBadge } from '@/app/admin/dugsi/components/shared/shift-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DugsiClassDTO } from '@/lib/types/dugsi-attendance'

import { EditClassDialog } from './edit-class-dialog'
import { ManageStudentsDialog } from './manage-students-dialog'

interface ClassListProps {
  classes: DugsiClassDTO[]
}

export function ClassList({ classes }: ClassListProps) {
  const [editClass, setEditClass] = useState<DugsiClassDTO | null>(null)
  const [manageStudentsClass, setManageStudentsClass] =
    useState<DugsiClassDTO | null>(null)

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-8 w-8" />}
        title="No classes found"
        description="Create a class to get started with student assignments."
      />
    )
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden rounded-md border lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((dugsiClass) => (
              <TableRow
                key={dugsiClass.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setManageStudentsClass(dugsiClass)}
              >
                <TableCell>
                  <div>
                    <p className="font-medium">{dugsiClass.name}</p>
                    {dugsiClass.description && (
                      <p className="text-sm text-muted-foreground">
                        {dugsiClass.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <ShiftBadge shift={dugsiClass.shift} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{dugsiClass.studentCount}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={dugsiClass.isActive ? 'default' : 'secondary'}
                  >
                    {dugsiClass.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setManageStudentsClass(dugsiClass)}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Manage Students
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditClass(dugsiClass)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Class
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="grid gap-4 md:grid-cols-2 lg:hidden">
        {classes.map((dugsiClass) => (
          <Card
            key={dugsiClass.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              !dugsiClass.isActive ? 'opacity-60' : ''
            }`}
            onClick={() => setManageStudentsClass(dugsiClass)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{dugsiClass.name}</h3>
                    <Badge
                      variant={dugsiClass.isActive ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {dugsiClass.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {dugsiClass.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {dugsiClass.description}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setManageStudentsClass(dugsiClass)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Manage Students
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditClass(dugsiClass)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Class
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <ShiftBadge shift={dugsiClass.shift} />
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{dugsiClass.studentCount} students</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialogs */}
      {editClass && (
        <EditClassDialog
          dugsiClass={editClass}
          open={!!editClass}
          onOpenChange={(open) => !open && setEditClass(null)}
        />
      )}

      {manageStudentsClass && (
        <ManageStudentsDialog
          dugsiClass={manageStudentsClass}
          open={!!manageStudentsClass}
          onOpenChange={(open) => !open && setManageStudentsClass(null)}
        />
      )}
    </>
  )
}
