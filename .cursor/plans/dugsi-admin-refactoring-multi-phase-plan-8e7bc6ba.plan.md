<!-- 8e7bc6ba-a828-4684-ad3c-daec409378ef 7185735a-88e7-4ff8-8d27-c54418e0c23d -->
# Dugsi Admin Refactoring - Multi-Phase Plan

## Executive Summary

This plan refactors the Dugsi admin module to eliminate DRY violations, improve architecture, and align with Next.js App Router and TypeScript best practices. The refactoring is organized into 6 phases that can be implemented incrementally.

## Current State Analysis

### Architecture Issues

- ✅ Page is Server Component (good)
- ❌ All child components are Client Components (should be Server where possible)
- ❌ Large Client Component (`dugsi-dashboard.tsx` ~620 lines) should be split
- ❌ Data fetching happens in Server Component but passed to Client Component

### Type System Issues

- ❌ `DugsiRegistration` interface duplicated in 4 files with variations
- ❌ Inline type definitions in component props
- ❌ Inconsistent field sets across components
- ❌ No centralized type exports

### DRY Violations

#### 1. Family Grouping Logic (3 locations)

- `dugsi-dashboard.tsx` (lines 98-124): Groups by `familyReferenceId || parentEmail || id`
- `dugsi-stats.tsx` (lines 19-35): Same grouping logic
- `actions.ts` (`getFamilyMembers`): Uses phone numbers instead (inconsistent!)

#### 2. Status Badge Logic (3+ locations)

- `family-grid-view.tsx` (lines 106-129): `getStatusBadge` function
- `dugsi-registrations-table.tsx` (lines 401-425): Inline badge rendering
- `payment-status-section.tsx`: Similar status checks
- Different badge styles for same statuses

#### 3. Filtering Logic (2 locations)

- `dugsi-dashboard.tsx` (lines 126-201): Complex filtering logic
- `dugsi-registrations-table.tsx` (lines 99-141, 190-223): Date range filtering + phone search
- `advanced-filters.tsx`: Filter UI but logic in dashboard

#### 4. Formatting Utilities (multiple locations)

- Parent name: `[firstName, lastName].filter(Boolean).join(' ')` repeated 5+ times
- Date formatting: `formatDate` function duplicated
- Phone number display patterns repeated
- Status badge rendering duplicated

#### 5. Prisma Select Objects (duplicated)

- `getDugsiRegistrations`: Large select object (lines 15-44)
- `getFamilyMembers`: Nearly identical select object (lines 77-106)
- `getDugsiPaymentStatus`: Partial select object

---

## Phase 1: Foundation - Types & Constants

**Goal**: Establish single source of truth for types and constants

### 1.1 Create Centralized Types

**File**: `app/admin/dugsi/_types/index.ts`

```typescript
// Base types from Prisma
import { Gender, Student } from '@prisma/client'

// Full registration type (extends Prisma Student)
export type DugsiRegistration = Pick<Student, 
  'id' | 'name' | 'gender' | 'dateOfBirth' | 'educationLevel' | 
  'gradeLevel' | 'schoolName' | 'healthInfo' | 'createdAt' |
  'parentFirstName' | 'parentLastName' | 'parentEmail' | 'parentPhone' |
  'parent2FirstName' | 'parent2LastName' | 'parent2Email' | 'parent2Phone' |
  'paymentMethodCaptured' | 'paymentMethodCapturedAt' |
  'stripeCustomerIdDugsi' | 'stripeSubscriptionIdDugsi' | 
  'subscriptionStatus' | 'paidUntil' | 'currentPeriodStart' | 
  'currentPeriodEnd' | 'familyReferenceId' | 'stripeAccountType'
>

// Family type
export interface Family {
  familyKey: string
  members: DugsiRegistration[]
  hasPayment: boolean
  hasSubscription: boolean
  parentEmail: string | null
  parentPhone: string | null
}

// Filter types
export interface FamilyFilters {
  dateRange: { start: Date; end: Date } | null
  schools: string[]
  grades: string[]
  hasHealthInfo: boolean
}

export type TabValue = 'overview' | 'active' | 'pending' | 'needs-attention' | 'all'
export type ViewMode = 'grid' | 'table'
export type DateFilter = 'all' | 'today' | 'yesterday' | 'thisWeek' | 'lastWeek'
export type FamilyStatus = 'active' | 'pending' | 'no-payment'

// Action result types
export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
```

### 1.2 Create Prisma Select Utilities

**File**: `app/admin/dugsi/_queries/selects.ts`

```typescript
// Centralized Prisma select objects
export const DUGSI_REGISTRATION_SELECT = {
  id: true,
  name: true,
  gender: true,
  // ... all fields
} as const

export const DUGSI_FAMILY_SELECT = {
  parentPhone: true,
  parent2Phone: true,
} as const

export const DUGSI_PAYMENT_STATUS_SELECT = {
  id: true,
  name: true,
  // ... payment fields only
} as const
```

### 1.3 Update Constants

**File**: `lib/constants/dugsi.ts` (already exists, enhance it)

- Add missing constants
- Ensure all magic strings are constants

**Deliverables**:

- ✅ All types centralized
- ✅ No duplicate type definitions
- ✅ Prisma selects reusable
- ✅ All components import from `_types`

---

## Phase 2: Utilities - Family & Status Logic

**Goal**: Extract and centralize family grouping and status calculation

### 2.1 Family Utilities

**File**: `app/admin/dugsi/_utils/family.ts`

```typescript
import { DugsiRegistration, Family, FamilyStatus } from '../_types'

/**
 * Get family key from registration
 * Priority: familyReferenceId > parentEmail > id
 */
export function getFamilyKey(registration: DugsiRegistration): string {
  return registration.familyReferenceId || 
         registration.parentEmail || 
         registration.id
}

/**
 * Group registrations by family
 * Sorts members by creation date (oldest first)
 */
export function groupRegistrationsByFamily(
  registrations: DugsiRegistration[]
): Family[] {
  const groups = new Map<string, DugsiRegistration[]>()

  // Group by family key
  for (const reg of registrations) {
    const key = getFamilyKey(reg)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(reg)
  }

  // Convert to Family objects
  return Array.from(groups.entries()).map(([key, members]) => {
    const sorted = members.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    return {
      familyKey: key,
      members: sorted,
      hasPayment: sorted.some(m => m.paymentMethodCaptured),
      hasSubscription: sorted.some(
        m => m.stripeSubscriptionIdDugsi && m.subscriptionStatus === 'active'
      ),
      parentEmail: sorted[0]?.parentEmail ?? null,
      parentPhone: sorted[0]?.parentPhone ?? null,
    }
  })
}

/**
 * Calculate family status
 */
export function getFamilyStatus(family: Family): FamilyStatus {
  if (family.hasSubscription) return 'active'
  if (family.hasPayment) return 'pending'
  return 'no-payment'
}

/**
 * Get phone numbers for family lookup
 * Used by actions.ts for consistent family identification
 */
export function getFamilyPhoneNumbers(
  registration: DugsiRegistration
): string[] {
  return [registration.parentPhone, registration.parent2Phone]
    .filter((phone): phone is string => Boolean(phone))
}
```

### 2.2 Status Utilities

**File**: `app/admin/dugsi/_utils/status.ts`

```typescript
import { FamilyStatus } from '../_types'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'

/**
 * Get status badge configuration
 */
export function getStatusBadgeConfig(status: FamilyStatus) {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        icon: CheckCircle2,
        className: 'bg-green-100 text-green-800 hover:bg-green-100',
      }
    case 'pending':
      return {
        label: 'Pending Setup',
        icon: AlertCircle,
        className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
      }
    case 'no-payment':
      return {
        label: 'No Payment',
        icon: XCircle,
        className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
      }
  }
}

/**
 * Render status badge component
 */
export function FamilyStatusBadge({ status }: { status: FamilyStatus }) {
  const config = getStatusBadgeConfig(status)
  const Icon = config.icon
  
  return (
    <Badge className={config.className}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}
```

**Deliverables**:

- ✅ Single source of truth for family grouping
- ✅ Consistent family key generation
- ✅ Reusable status badge component
- ✅ Testable utility functions

---

## Phase 3: Utilities - Formatting & Filtering

**Goal**: Centralize formatting and filtering logic

### 3.1 Formatting Utilities

**File**: `app/admin/dugsi/_utils/format.ts`

```typescript
import { format } from 'date-fns'
import { DATE_FORMAT } from '@/lib/constants/dugsi'
import { DugsiRegistration } from '../_types'

/**
 * Format parent name from first and last name
 */
export function formatParentName(
  firstName: string | null,
  lastName: string | null
): string {
  return [firstName, lastName].filter(Boolean).join(' ') || 'Not provided'
}

/**
 * Check if registration has second parent
 */
export function hasSecondParent(registration: DugsiRegistration): boolean {
  return !!(
    registration.parent2FirstName || 
    registration.parent2LastName
  )
}

/**
 * Format date consistently
 */
export function formatRegistrationDate(
  date: Date | string | null
): string {
  if (!date) return '—'
  const dateObj = date instanceof Date ? date : new Date(date)
  return format(dateObj, DATE_FORMAT)
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date | string | null): string {
  if (!dateOfBirth) return 'N/A'
  const birthDate = dateOfBirth instanceof Date 
    ? dateOfBirth 
    : new Date(dateOfBirth)
  const today = new Date()
  
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || 
      (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return `${age} years old`
}
```

### 3.2 Filter Utilities

**File**: `app/admin/dugsi/_utils/filters.ts`

```typescript
import { Family, FamilyFilters, DateFilter, TabValue } from '../_types'

/**
 * Get date range from filter type
 */
export function getDateRange(
  filter: DateFilter
): { start: Date; end: Date } | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (filter) {
    case 'all':
      return null
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      }
    case 'yesterday':
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      return { start: yesterday, end: today }
    case 'thisWeek':
      const dayOfWeek = today.getDay()
      const startOfWeek = new Date(
        today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000
      )
      return {
        start: startOfWeek,
        end: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      }
    case 'lastWeek':
      const dayOfWeek2 = today.getDay()
      const startOfLastWeek = new Date(
        today.getTime() - (dayOfWeek2 + 7) * 24 * 60 * 60 * 1000
      )
      const endOfLastWeek = new Date(
        today.getTime() - dayOfWeek2 * 24 * 60 * 60 * 1000
      )
      return { start: startOfLastWeek, end: endOfLastWeek }
  }
}

/**
 * Filter families by search query
 */
export function filterFamiliesBySearch(
  families: Family[],
  query: string
): Family[] {
  if (!query) return families
  
  const normalizedQuery = query.toLowerCase()
  
  return families.filter(family => {
    return family.members.some(member =>
      member.name?.toLowerCase().includes(normalizedQuery) ||
      member.parentEmail?.toLowerCase().includes(normalizedQuery) ||
      member.parentPhone?.includes(query) ||
      member.schoolName?.toLowerCase().includes(normalizedQuery)
    )
  })
}

/**
 * Filter families by advanced filters
 */
export function filterFamiliesByAdvanced(
  families: Family[],
  filters: FamilyFilters
): Family[] {
  let filtered = families

  // Date range filter
  if (filters.dateRange) {
    filtered = filtered.filter(family => {
      return family.members.some(member => {
        const date = new Date(member.createdAt)
        return (
          date >= filters.dateRange!.start && 
          date <= filters.dateRange!.end
        )
      })
    })
  }

  // School filter
  if (filters.schools.length > 0) {
    filtered = filtered.filter(family => {
      return family.members.some(member =>
        filters.schools.includes(member.schoolName || '')
      )
    })
  }

  // Grade filter
  if (filters.grades.length > 0) {
    filtered = filtered.filter(family => {
      return family.members.some(member =>
        filters.grades.includes(member.gradeLevel || '')
      )
    })
  }

  // Health info filter
  if (filters.hasHealthInfo) {
    filtered = filtered.filter(family => {
      return family.members.some(
        member =>
          member.healthInfo && 
          member.healthInfo.toLowerCase() !== 'none'
      )
    })
  }

  return filtered
}

/**
 * Filter families by tab
 */
export function filterFamiliesByTab(
  families: Family[],
  tab: TabValue
): Family[] {
  switch (tab) {
    case 'overview':
      return families // Show all
    case 'active':
      return families.filter(f => f.hasSubscription)
    case 'pending':
      return families.filter(f => f.hasPayment && !f.hasSubscription)
    case 'needs-attention':
      return families.filter(f => !f.hasPayment)
    case 'all':
      return families
  }
}

/**
 * Composite filter function
 */
export function applyAllFilters(
  families: Family[],
  options: {
    tab?: TabValue
    searchQuery?: string
    advancedFilters?: FamilyFilters
  }
): Family[] {
  let filtered = families

  if (options.tab) {
    filtered = filterFamiliesByTab(filtered, options.tab)
  }

  if (options.searchQuery) {
    filtered = filterFamiliesBySearch(filtered, options.searchQuery)
  }

  if (options.advancedFilters) {
    filtered = filterFamiliesByAdvanced(filtered, options.advancedFilters)
  }

  return filtered
}
```

**Deliverables**:

- ✅ All formatting logic centralized
- ✅ All filtering logic reusable
- ✅ Composable filter functions
- ✅ Easy to test

---

## Phase 4: Custom Hooks

**Goal**: Extract complex logic into reusable hooks

### 4.1 Family Groups Hook

**File**: `app/admin/dugsi/_hooks/use-family-groups.ts`

```typescript
'use client'

import { useMemo } from 'react'
import { DugsiRegistration, Family } from '../_types'
import { groupRegistrationsByFamily } from '../_utils/family'

export function useFamilyGroups(
  registrations: DugsiRegistration[]
): Family[] {
  return useMemo(
    () => groupRegistrationsByFamily(registrations),
    [registrations]
  )
}

export function useFamilyStats(families: Family[]) {
  return useMemo(
    () => ({
      all: families.length,
      active: families.filter(f => f.hasSubscription).length,
      pending: families.filter(f => f.hasPayment && !f.hasSubscription).length,
      needsAttention: families.filter(f => !f.hasPayment).length,
    }),
    [families]
  )
}
```

### 4.2 Family Filters Hook

**File**: `app/admin/dugsi/_hooks/use-family-filters.ts`

```typescript
'use client'

import { useMemo } from 'react'
import { Family, FamilyFilters, TabValue } from '../_types'
import { applyAllFilters } from '../_utils/filters'

export function useFamilyFilters(
  families: Family[],
  options: {
    tab: TabValue
    searchQuery: string
    advancedFilters: FamilyFilters
  }
): Family[] {
  return useMemo(
    () => applyAllFilters(families, options),
    [families, options.tab, options.searchQuery, options.advancedFilters]
  )
}
```

**Deliverables**:

- ✅ Memoized computations
- ✅ Reusable hooks
- ✅ Better performance
- ✅ Cleaner component code

---

## Phase 5: Reusable Components

**Goal**: Extract repeated UI patterns into reusable components

### 5.1 Status Badge Component

**File**: `app/admin/dugsi/components/family-status-badge.tsx`

```typescript
'use client'

import { FamilyStatus } from '../_types'
import { getStatusBadgeConfig } from '../_utils/status'
import { Badge } from '@/components/ui/badge'

export function FamilyStatusBadge({ status }: { status: FamilyStatus }) {
  const config = getStatusBadgeConfig(status)
  const Icon = config.icon
  
  return (
    <Badge className={config.className}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}
```

### 5.2 Parent Info Component

**File**: `app/admin/dugsi/components/parent-info.tsx`

```typescript
'use client'

import { Mail, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DugsiRegistration } from '../_types'
import { formatParentName, hasSecondParent } from '../_utils/format'

interface ParentInfoProps {
  registration: DugsiRegistration
  showEmail?: boolean
  showPhone?: boolean
  showSecondParentBadge?: boolean
}

export function ParentInfo({
  registration,
  showEmail = true,
  showPhone = true,
  showSecondParentBadge = true,
}: ParentInfoProps) {
  const parentName = formatParentName(
    registration.parentFirstName,
    registration.parentLastName
  )
  const hasSecond = hasSecondParent(registration)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium">{parentName}</span>
        {hasSecond && showSecondParentBadge && (
          <Badge variant="outline" className="text-xs">
            2 Parents
          </Badge>
        )}
      </div>
      
      {showEmail && registration.parentEmail && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          <span className="truncate">{registration.parentEmail}</span>
        </div>
      )}
      
      {showPhone && registration.parentPhone && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          <span>{registration.parentPhone}</span>
        </div>
      )}
    </div>
  )
}
```

**Deliverables**:

- ✅ Reusable UI components
- ✅ Consistent styling
- ✅ Less code duplication
- ✅ Easier to maintain

---

## Phase 6: Refactor Components & Actions

**Goal**: Update all components to use new utilities and improve architecture

### 6.1 Refactor Actions

**File**: `app/admin/dugsi/actions.ts`

- Use `DUGSI_REGISTRATION_SELECT` from `_queries/selects.ts`
- Use `getFamilyPhoneNumbers` from `_utils/family.ts`
- Use `DUGSI_PROGRAM` constant
- Improve error handling with constants

### 6.2 Refactor Components

**Update**: `dugsi-dashboard.tsx`

- Import types from `_types`
- Use `useFamilyGroups` hook
- Use `useFamilyFilters` hook
- Use `useFamilyStats` hook
- Remove inline grouping logic
- Remove inline filtering logic

**Update**: `family-grid-view.tsx`

- Import types from `_types`
- Use `FamilyStatusBadge` component
- Use `ParentInfo` component
- Use formatting utilities
- Remove duplicate status logic

**Update**: `dugsi-registrations-table.tsx`

- Import types from `_types`
- Use `FamilyStatusBadge` component
- Use formatting utilities
- Remove duplicate `formatDate` function
- Use filter utilities

**Update**: `dugsi-stats.tsx`

- Import types from `_types`
- Use `groupRegistrationsByFamily` utility
- Remove duplicate grouping logic

**Update**: `advanced-filters.tsx`

- Import types from `_types`
- Keep UI logic, filter logic handled by hooks

**Update**: `payment-status-section.tsx`

- Import types from `_types`
- Use status utilities if beneficial

### 6.3 Optimize Server/Client Split

**Consider**: Split `dugsi-dashboard.tsx` into:

- Server Component wrapper (data fetching)
- Client Component (interactivity)

**Deliverables**:

- ✅ All components use centralized types
- ✅ All components use utilities
- ✅ No duplicate logic
- ✅ Better Server/Client separation

---

## Implementation Guidelines

### File Structure After Refactoring

```
app/admin/dugsi/
├── _types/
│   └── index.ts              # All type definitions
├── _queries/
│   └── selects.ts            # Prisma select objects
├── _utils/
│   ├── family.ts            # Family grouping utilities
│   ├── status.ts            # Status calculation utilities
│   ├── format.ts            # Formatting utilities
│   └── filters.ts           # Filtering utilities
├── _hooks/
│   ├── use-family-groups.ts # Family grouping hook
│   └── use-family-filters.ts # Filtering hook
├── actions.ts                # Server actions
├── page.tsx                  # Server Component page
└── components/
    ├── dugsi-dashboard.tsx
    ├── family-grid-view.tsx
    ├── family-status-badge.tsx  # NEW
    ├── parent-info.tsx          # NEW
    ├── advanced-filters.tsx
    ├── quick-actions-bar.tsx
    ├── dugsi-registrations-table.tsx
    ├── dugsi-stats.tsx
    ├── payment-status-section.tsx
    └── link-subscription-dialog.tsx
```

### Testing Strategy

1. Test utilities independently
2. Test hooks with React Testing Library
3. Integration tests for components
4. E2E tests for critical flows

### Migration Steps

1. Create new files (`_types`, `_utils`, etc.)
2. Update one component at a time
3. Test after each component update
4. Remove old code once all components updated

---

## Success Metrics

- ✅ Zero duplicate type definitions
- ✅ Zero duplicate utility functions
- ✅ Single source of truth for family grouping
- ✅ Consistent status badge rendering
- ✅ Improved code maintainability
- ✅ Better TypeScript type safety
- ✅ Aligned with Next.js best practices

---

## Notes

- Each phase can be implemented independently
- Phases build on each other but can be done incrementally
- No breaking changes to external APIs
- Maintain backward compatibility during migration