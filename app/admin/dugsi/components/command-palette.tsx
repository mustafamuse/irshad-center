/**
 * Searchable command palette for quick actions
 */
'use client'

import { useEffect, useState } from 'react'

import {
  LayoutGrid,
  Table2,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Download,
} from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

import { useLegacyActions } from '../store'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport?: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  onExport,
}: CommandPaletteProps) {
  const { setViewMode, setActiveTab } = useLegacyActions()
  const [search, setSearch] = useState('')

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  const runCommand = (command: () => void) => {
    command()
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="View">
          <CommandItem
            onSelect={() => runCommand(() => setViewMode('grid'))}
            keywords={['parents', 'grid', 'cards', 'families']}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>Parents</span>
            <CommandShortcut>G</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setViewMode('table'))}
            keywords={['students', 'table', 'list', 'registrations']}
          >
            <Table2 className="mr-2 h-4 w-4" />
            <span>Students</span>
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          <CommandItem
            onSelect={() => runCommand(() => setActiveTab('overview'))}
            keywords={['overview', 'stats', 'dashboard']}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>Overview</span>
            <CommandShortcut>1</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setActiveTab('active'))}
            keywords={['active', 'subscriptions']}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            <span>Active Families</span>
            <CommandShortcut>2</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setActiveTab('pending'))}
            keywords={['pending', 'setup']}
          >
            <Clock className="mr-2 h-4 w-4" />
            <span>Pending Setup</span>
            <CommandShortcut>3</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setActiveTab('needs-attention'))}
            keywords={['attention', 'action', 'needs']}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            <span>Needs Attention</span>
            <CommandShortcut>4</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setActiveTab('all'))}
            keywords={['all', 'everyone']}
          >
            <Users className="mr-2 h-4 w-4" />
            <span>All Families</span>
            <CommandShortcut>5</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => onExport && runCommand(onExport)}
            keywords={['export', 'download', 'csv']}
            disabled={!onExport}
          >
            <Download className="mr-2 h-4 w-4" />
            <span>Export to CSV</span>
            <CommandShortcut>⌘E</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
