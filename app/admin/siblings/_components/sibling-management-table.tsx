'use client'

import { useState, useEffect } from 'react'

import { Users, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface SiblingGroup {
  siblings: Array<{
    person: {
      id: string
      name: string
      dateOfBirth: string | null
    }
    profiles: Array<{
      id: string
      program: string
      status: string
      enrollments: Array<{
        id: string
        status: string
        startDate: string
      }>
    }>
  }>
  totalSiblings: number
  programs: string[]
}

export function SiblingManagementTable() {
  const [groups, setGroups] = useState<SiblingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [programFilter, setProgramFilter] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [person1Search, setPerson1Search] = useState('')
  const [person2Search, setPerson2Search] = useState('')

  useEffect(() => {
    fetchGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programFilter])

  async function fetchGroups() {
    try {
      setLoading(true)
      const url =
        programFilter === 'all'
          ? '/api/admin/siblings/cross-program'
          : `/api/admin/siblings/cross-program?program=${programFilter}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setGroups(data.data.groups || [])
      } else {
        toast.error(data.error || 'Failed to fetch sibling groups')
      }
    } catch (error) {
      toast.error('Failed to fetch sibling groups')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddSibling(person1Id: string, person2Id: string) {
    try {
      const response = await fetch('/api/admin/siblings/cross-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person1Id,
          person2Id,
          verifiedBy: 'admin', // TODO: Get from auth
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Sibling relationship created')
        setIsAddDialogOpen(false)
        fetchGroups()
      } else {
        toast.error(data.error || 'Failed to create sibling relationship')
      }
    } catch (error) {
      toast.error('Failed to create sibling relationship')
    }
  }

  const filteredGroups = groups.filter((group) => {
    if (!searchQuery) return true
    return group.siblings.some((sibling) =>
      sibling.person.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  if (loading) {
    return <div>Loading sibling groups...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search siblings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={programFilter} onValueChange={setProgramFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by program" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            <SelectItem value="MAHAD_PROGRAM">Mahad</SelectItem>
            <SelectItem value="DUGSI_PROGRAM">Dugsi</SelectItem>
            <SelectItem value="YOUTH_EVENTS">Youth Events</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Sibling Relationship
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Sibling Relationship</DialogTitle>
              <DialogDescription>
                Manually link two people as siblings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Person 1 ID</Label>
                <Input
                  value={person1Search}
                  onChange={(e) => setPerson1Search(e.target.value)}
                  placeholder="Enter person ID"
                />
              </div>
              <div>
                <Label>Person 2 ID</Label>
                <Input
                  value={person2Search}
                  onChange={(e) => setPerson2Search(e.target.value)}
                  placeholder="Enter person ID"
                />
              </div>
              <Button
                onClick={() => {
                  if (person1Search && person2Search) {
                    handleAddSibling(person1Search, person2Search)
                  }
                }}
                disabled={!person1Search || !person2Search}
              >
                Create Relationship
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No sibling groups found
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Siblings</TableHead>
              <TableHead>Programs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.map((group, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <div className="space-y-1">
                    {group.siblings.map((sibling) => (
                      <div
                        key={sibling.person.id}
                        className="flex items-center gap-2"
                      >
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {sibling.person.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {group.programs.map((program) => (
                      <Badge key={program} variant="outline">
                        {program.replace('_PROGRAM', '')}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {group.totalSiblings >= 2 ? (
                    <Badge variant="default">Discount Eligible</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
