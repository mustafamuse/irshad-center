'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { useRouter, usePathname } from 'next/navigation'

import {
  GraduationCap,
  Users,
  FileText,
  Search,
  Home,
  UserPlus,
  Link2,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  searchPeopleAction,
  type PersonSearchResult,
} from '@/app/admin/dugsi/teachers/actions'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useDebounce } from '@/hooks/use-debounce'
import { ADMIN_NAVIGATION } from '@/lib/constants/admin-navigation'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface NavigationItem {
  title: string
  url: string
  icon: React.ReactNode
  group: string
}

function getIconForUrl(url: string, isSubItem: boolean): React.ReactNode {
  if (isSubItem) {
    return <ArrowRight className="h-4 w-4" />
  }
  if (url.includes('dugsi')) {
    return <Users className="h-4 w-4" />
  }
  if (url.includes('mahad')) {
    return <GraduationCap className="h-4 w-4" />
  }
  return <FileText className="h-4 w-4" />
}

function buildNavigationItems(): Record<string, NavigationItem[]> {
  const grouped: Record<string, NavigationItem[]> = {}

  for (const group of ADMIN_NAVIGATION) {
    for (const item of group.items) {
      if (!item.url.startsWith('/admin')) continue

      if (!grouped[group.title]) {
        grouped[group.title] = []
      }

      grouped[group.title].push({
        title: item.title,
        url: item.url,
        icon: getIconForUrl(item.url, false),
        group: group.title,
      })

      if (item.items) {
        for (const subItem of item.items) {
          grouped[group.title].push({
            title: subItem.title,
            url: subItem.url,
            icon: getIconForUrl(subItem.url, true),
            group: group.title,
          })
        }
      }
    }
  }

  return grouped
}

const GROUPED_NAV = buildNavigationItems()

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([])
  const [isSearching, startSearchTransition] = useTransition()
  const debouncedQuery = useDebounce(searchQuery, 300)
  const lastSearchRef = useRef('')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [open])

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    const currentQuery = debouncedQuery
    lastSearchRef.current = currentQuery

    startSearchTransition(async () => {
      try {
        const result = await searchPeopleAction(currentQuery)
        if (lastSearchRef.current !== currentQuery) return
        if (result.success && result.data) {
          setSearchResults(result.data)
        } else {
          toast.error(result.error || 'Search failed. Please try again.')
          setSearchResults([])
        }
      } catch {
        if (lastSearchRef.current !== currentQuery) return
        toast.error('Search failed. Please try again.')
        setSearchResults([])
      }
    })
  }, [debouncedQuery])

  function handleSelect(url: string): void {
    router.push(url)
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <span id="command-palette-desc" className="sr-only">
        Quick navigation and search. Press Escape to close.
      </span>
      <CommandInput
        placeholder="Search for people, navigate to pages..."
        value={searchQuery}
        onValueChange={setSearchQuery}
        aria-describedby="command-palette-desc"
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? 'Searching...' : 'No results found.'}
        </CommandEmpty>

        {searchResults.length > 0 && (
          <>
            <CommandGroup heading="People">
              {searchResults.slice(0, 5).map((result) => (
                <CommandItem
                  key={result.id}
                  onSelect={() =>
                    handleSelect(
                      `/admin/people/lookup?q=${encodeURIComponent(result.name)}`
                    )
                  }
                >
                  <Search className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{result.name}</span>
                    {(result.email || result.phone) && (
                      <span className="text-xs text-muted-foreground">
                        {result.email || result.phone}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => handleSelect('/admin/mahad')}>
            <UserPlus className="mr-2 h-4 w-4" />
            <span>Add Mahad Student</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/dugsi')}>
            <UserPlus className="mr-2 h-4 w-4" />
            <span>Add Dugsi Family</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect('/admin/link-subscriptions')}
          >
            <Link2 className="mr-2 h-4 w-4" />
            <span>Link Subscriptions</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />

        {Object.entries(GROUPED_NAV).map(([groupTitle, items]) => (
          <CommandGroup key={groupTitle} heading={groupTitle}>
            {items.map((item) => (
              <CommandItem
                key={item.url}
                onSelect={() => handleSelect(item.url)}
                className={pathname === item.url ? 'bg-accent' : ''}
              >
                {item.icon}
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />
        <CommandGroup>
          <CommandItem onSelect={() => handleSelect('/')}>
            <Home className="mr-2 h-4 w-4" />
            <span>Go to Home</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
