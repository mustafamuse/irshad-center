'use client'

import { useState } from 'react'

import { Check, ChevronsUpDown, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
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

import type { TeacherForDropdown } from '../actions'

interface TeacherSelectorProps {
  teachers: TeacherForDropdown[]
  selectedTeacherId: string | null
  onSelect: (teacherId: string | null) => void
  disabled?: boolean
}

export function TeacherSelector({
  teachers,
  selectedTeacherId,
  onSelect,
  disabled = false,
}: TeacherSelectorProps) {
  const [open, setOpen] = useState(false)

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-12 w-full justify-between text-base"
        >
          {selectedTeacher ? (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{selectedTeacher.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select your name...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search teachers..." />
          <CommandList>
            <CommandEmpty>No teacher found.</CommandEmpty>
            <CommandGroup>
              {teachers.map((teacher) => (
                <CommandItem
                  key={teacher.id}
                  value={teacher.name}
                  onSelect={() => {
                    onSelect(
                      teacher.id === selectedTeacherId ? null : teacher.id
                    )
                    setOpen(false)
                  }}
                  className="py-3"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedTeacherId === teacher.id
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{teacher.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {teacher.shifts.join(' & ')} shift
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
