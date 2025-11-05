/**
 * Mobile Filter Drawer Component
 * Bottom sheet drawer for filters on mobile devices
 */
'use client'

import { Filter } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

interface MobileFilterDrawerProps {
  children: React.ReactNode
  activeFilterCount?: number
}

export function MobileFilterDrawer({
  children,
  activeFilterCount = 0,
}: MobileFilterDrawerProps) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filter Families</DrawerTitle>
        </DrawerHeader>
        <div className="max-h-[80vh] overflow-y-auto px-4 pb-4">{children}</div>
      </DrawerContent>
    </Drawer>
  )
}
