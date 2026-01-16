'use client'

import { useState, useEffect, useRef } from 'react'

import { Check, ChevronsUpDown, Search, User } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import type { StudentMatch } from '../actions'
import { searchStudents, getPotentialMatches } from '../actions'

interface StudentSelectorProps {
  program: 'MAHAD' | 'DUGSI'
  customerEmail: string | null
  potentialMatches?: StudentMatch[]
  value: StudentMatch | null
  onChange: (student: StudentMatch | null) => void
}

export function StudentSelector({
  program,
  customerEmail,
  potentialMatches = [],
  value,
  onChange,
}: StudentSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StudentMatch[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(
    undefined
  )
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen && triggerRef.current) {
      setPopoverWidth(triggerRef.current.offsetWidth)
    }
  }

  // Combine potential matches with search results
  const displayStudents = searchQuery
    ? searchResults
    : potentialMatches.length > 0
      ? potentialMatches
      : searchResults

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults(potentialMatches)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const result = await searchStudents(searchQuery, program)
        if (result.success) {
          setSearchResults(result.data)
        }
      } catch (error) {
        toast.error('Failed to search students')
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, program, potentialMatches])

  // Load potential matches on mount if we have an email
  useEffect(() => {
    if (customerEmail && potentialMatches.length === 0) {
      getPotentialMatches(customerEmail, program)
        .then((result) => {
          if (result.success) {
            setSearchResults(result.data)
          }
        })
        .catch(() => toast.error('Failed to load potential matches'))
    }
  }, [customerEmail, program, potentialMatches.length])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-[40px] w-full justify-between py-2"
        >
          {value ? (
            <div className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate font-medium">{value.name}</span>
              {value.hasSubscription && (
                <Badge variant="destructive" className="shrink-0 text-xs">
                  Has Sub
                </Badge>
              )}
            </div>
          ) : (
            <span className="font-normal text-muted-foreground">
              Search for student...
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        sideOffset={4}
        style={{ width: popoverWidth ? `${popoverWidth}px` : undefined }}
      >
        <Command shouldFilter={false} className="rounded-lg border shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList className="max-h-[300px]">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Searching...
                </div>
              </div>
            ) : displayStudents.length === 0 ? (
              <div className="py-8 text-center">
                <User className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  {searchQuery ? 'No students found' : 'Start typing to search'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Search by name, email, or phone number'}
                </p>
              </div>
            ) : (
              <CommandGroup className="p-2">
                {displayStudents.map((student) => (
                  <CommandItem
                    key={student.id}
                    value={student.id}
                    onSelect={() => {
                      onChange(student)
                      setOpen(false)
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2 py-3 aria-selected:bg-accent"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0 text-primary',
                          value?.id === student.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {student.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {student.email}
                        </span>
                        {student.phone && (
                          <span className="text-xs text-muted-foreground">
                            {student.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {student.status}
                      </Badge>
                      {student.hasSubscription && (
                        <Badge variant="destructive" className="text-xs">
                          Has Sub
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
