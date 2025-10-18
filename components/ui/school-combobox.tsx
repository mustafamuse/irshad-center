'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
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

export interface School {
  name: string
  city: string
  level: string
}

interface SchoolComboboxProps {
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function SchoolCombobox({
  value = '',
  onChange,
  onBlur,
  placeholder = 'Select school...',
  className,
  disabled = false,
}: SchoolComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [schools, setSchools] = React.useState<School[]>([])
  const [customValue, setCustomValue] = React.useState('')

  // Load schools data
  React.useEffect(() => {
    fetch('/data/mn-schools.json')
      .then((res) => res.json())
      .then((data) => setSchools(data))
      .catch((err) => console.error('Failed to load schools:', err))
  }, [])

  // Handle value change
  const handleSelect = (schoolName: string) => {
    onChange?.(schoolName)
    setCustomValue('')
    setOpen(false)
  }

  // Handle custom input
  const handleCustomInput = (input: string) => {
    setCustomValue(input)
    onChange?.(input)
  }

  const displayValue = value || customValue

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !displayValue && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
          onBlur={onBlur}
        >
          <span className="truncate">{displayValue || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search schools or type custom..."
            value={customValue}
            onValueChange={handleCustomInput}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-6 text-center text-sm">
                <p className="text-muted-foreground">No school found.</p>
                {customValue && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Type to use custom school name
                  </p>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {schools
                .filter((school) =>
                  school.name
                    .toLowerCase()
                    .includes((customValue || value || '').toLowerCase())
                )
                .slice(0, 50)
                .map((school, index) => (
                  <CommandItem
                    key={`${school.name}-${school.city}-${index}`}
                    value={school.name}
                    onSelect={() => handleSelect(school.name)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === school.name ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{school.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {school.city} • {school.level}
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
