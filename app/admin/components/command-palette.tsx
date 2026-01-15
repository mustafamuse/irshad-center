'use client'

import { useEffect, useState, useTransition } from 'react'

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
import { ADMIN_NAVIGATION } from '@/lib/constants/admin-navigation'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([])
  const [isSearching, startSearchTransition] = useTransition()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [open])

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    startSearchTransition(async () => {
      try {
        const result = await searchPeopleAction(searchQuery)
        if (result.success && result.data) {
          setSearchResults(result.data)
        } else {
          setSearchResults([])
        }
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      }
    })
  }, [searchQuery])

  const handleSelect = (url: string) => {
    router.push(url)
    onOpenChange(false)
  }

  const navigationItems: Array<{
    title: string
    url: string
    icon: React.ReactNode
    group: string
  }> = []

  ADMIN_NAVIGATION.forEach((group) => {
    group.items.forEach((item) => {
      if (item.url.startsWith('/admin')) {
        navigationItems.push({
          title: item.title,
          url: item.url,
          icon: item.url.includes('dugsi') ? (
            <Users className="h-4 w-4" />
          ) : item.url.includes('mahad') ? (
            <GraduationCap className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          ),
          group: group.title,
        })

        // Add nested items
        if (item.items) {
          item.items.forEach((subItem) => {
            navigationItems.push({
              title: subItem.title,
              url: subItem.url,
              icon: <ArrowRight className="h-4 w-4" />,
              group: group.title,
            })
          })
        }
      }
    })
  })

  // Group navigation items
  const groupedNav = navigationItems.reduce(
    (acc, item) => {
      if (!acc[item.group]) {
        acc[item.group] = []
      }
      acc[item.group].push(item)
      return acc
    },
    {} as Record<string, typeof navigationItems>
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search for people, navigate to pages..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? 'Searching...' : 'No results found.'}
        </CommandEmpty>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <>
            <CommandGroup heading="People">
              {searchResults.slice(0, 5).map((result) => (
                <CommandItem
                  key={result.id}
                  onSelect={() =>
                    handleSelect(
                      `/admin/people/lookup?q=${encodeURIComponent(searchQuery)}`
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

        {/* Quick Actions */}
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

        {/* Navigation */}
        {Object.entries(groupedNav).map(([groupTitle, items]) => (
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

        {/* Home */}
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
