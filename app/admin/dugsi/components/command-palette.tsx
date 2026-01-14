'use client'

import { useEffect, useState } from 'react'

import {
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Users,
  Download,
  DollarSign,
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
  const { setActiveTab } = useLegacyActions()
  const [search, setSearch] = useState('')

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

        <CommandGroup heading="Navigate">
          <CommandItem
            onSelect={() => runCommand(() => setActiveTab('active'))}
            keywords={['active', 'subscriptions']}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            <span>Active Families</span>
            <CommandShortcut>1</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setActiveTab('churned'))}
            keywords={['churned', 'canceled', 'inactive']}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            <span>Churned Families</span>
            <CommandShortcut>2</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setActiveTab('needs-attention'))}
            keywords={['attention', 'action', 'needs', 'no payment']}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            <span>Needs Attention</span>
            <CommandShortcut>3</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setActiveTab('billing-mismatch'))}
            keywords={['billing', 'mismatch', 'variance']}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            <span>Billing Mismatch</span>
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
