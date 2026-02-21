# Component Patterns

This document describes the component patterns and best practices used in the Irshad Center application.

## Table of Contents

1. [Component Types](#component-types)
2. [Server Component Pattern](#server-component-pattern)
3. [Client Component Pattern](#client-component-pattern)
4. [Component Organization](#component-organization)
5. [State Management Patterns](#state-management-patterns)
6. [Error Handling Patterns](#error-handling-patterns)
7. [Loading State Patterns](#loading-state-patterns)
8. [Form Patterns](#form-patterns)

---

## Component Types

### Server Components (Default)

**When to use**:

- ✅ Data fetching
- ✅ Accessing backend resources (database, APIs)
- ✅ Keeping sensitive information on the server
- ✅ Reducing client-side JavaScript bundle size

**Characteristics**:

- No `'use client'` directive
- Can use `async/await` directly
- Cannot use React hooks (`useState`, `useEffect`, etc.)
- Cannot use browser APIs
- Rendered on the server

### Client Components

**When to use**:

- ✅ Interactivity (onClick, onChange, etc.)
- ✅ Browser APIs (localStorage, window, etc.)
- ✅ React hooks (useState, useEffect, etc.)
- ✅ Third-party libraries that require client-side code
- ✅ Animations (Framer Motion)

**Characteristics**:

- Must have `'use client'` directive
- Cannot use `async/await` in component body
- Can use React hooks
- Can use browser APIs
- Rendered on the client

---

## Server Component Pattern

### Basic Server Component

```typescript
// app/admin/dugsi/page.tsx
import { Metadata } from 'next'
import { getDugsiRegistrations } from './actions'
import { DugsiDashboard } from './components/dugsi-dashboard'

export const metadata: Metadata = {
  title: 'Dugsi Admin',
  description: 'Manage Dugsi program registrations',
}

export default async function DugsiAdminPage() {
  // Direct database access
  const registrations = await getDugsiRegistrations()

  return <DugsiDashboard registrations={registrations} />
}
```

### Server Component with Parallel Fetching

```typescript
// app/admin/mahad/page.tsx
export default async function CohortsPage() {
  // Parallel data fetching
  const [batches, students, duplicates] = await Promise.all([
    getBatches(),
    getStudentsWithBatch(),
    findDuplicateStudents(),
  ])

  return (
    <main>
      <BatchManagement batches={batches} students={students} />
      <StudentsTable students={students} batches={batches} />
    </main>
  )
}
```

### Server Component with Suspense

```typescript
// app/admin/dugsi/page.tsx
import { Suspense } from 'react'

export default async function DugsiAdminPage() {
  const registrations = await getDugsiRegistrations()

  return (
    <Suspense fallback={<Loading />}>
      <DugsiDashboard registrations={registrations} />
    </Suspense>
  )
}
```

### Server Component with Error Boundary

```typescript
// app/admin/dugsi/page.tsx
import { DugsiErrorBoundary } from './components/error-boundary'

export default async function DugsiAdminPage() {
  const registrations = await getDugsiRegistrations()

  return (
    <DugsiErrorBoundary>
      <DugsiDashboard registrations={registrations} />
    </DugsiErrorBoundary>
  )
}
```

---

## Client Component Pattern

### Basic Client Component

```typescript
// app/admin/dugsi/components/dashboard/dashboard-header.tsx
'use client'

import { Button } from '@/components/ui/button'
import { useViewMode, useLegacyActions } from '../../store'

export function DashboardHeader() {
  const viewMode = useViewMode()
  const { setViewMode } = useLegacyActions()

  return (
    <div className="flex items-center justify-between">
      <h1>Dugsi Program Management</h1>
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'grid' ? 'default' : 'outline'}
          onClick={() => setViewMode('grid')}
        >
          Parents
        </Button>
        <Button
          variant={viewMode === 'table' ? 'default' : 'outline'}
          onClick={() => setViewMode('table')}
        >
          Students
        </Button>
      </div>
    </div>
  )
}
```

### Client Component with State

```typescript
// app/admin/dugsi/components/dashboard/dashboard-filters.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { useDugsiFilters, useLegacyActions } from '../../store'

export function DashboardFilters() {
  const filters = useDugsiFilters()
  const { setSearchQuery } = useLegacyActions()

  return (
    <div className="flex gap-4">
      <Input
        value={filters.search?.query || ''}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search..."
      />
    </div>
  )
}
```

### Client Component with Server Action

```typescript
// app/admin/dugsi/components/dialogs/withdraw-family-dialog.tsx
'use client'

import { useTransition } from 'react'
import { withdrawAllFamilyChildrenAction } from '../../actions'

export function WithdrawFamilyDialog({ familyReferenceId }: { familyReferenceId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleWithdraw = () => {
    startTransition(async () => {
      const result = await withdrawAllFamilyChildrenAction({ familyReferenceId, reason: 'other' })
      if (result.success) {
        toast.success('Family withdrawn')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Button onClick={handleWithdraw} disabled={isPending}>
      {isPending ? 'Withdrawing...' : 'Withdraw All'}
    </Button>
  )
}
```

---

## Component Organization

### Feature-Based Organization

Components are organized by feature within each route:

```
app/admin/dugsi/
├── components/
│   ├── dashboard/           # Dashboard-specific
│   │   ├── dashboard-header.tsx
│   │   ├── dashboard-stats.tsx
│   │   ├── dashboard-filters.tsx
│   │   └── index.tsx        # Barrel export
│   ├── family-management/  # Family features
│   │   ├── family-grid-view.tsx
│   │   ├── family-status-badge.tsx
│   │   └── index.tsx
│   ├── registrations/      # Registration table
│   │   ├── registrations-table.tsx
│   │   └── index.tsx
│   ├── dialogs/            # All dialogs
│   │   ├── withdraw-family-dialog.tsx
│   │   ├── link-subscription-dialog.tsx
│   │   └── index.tsx
│   └── ui/                 # Shared UI components
│       ├── parent-info.tsx
│       └── index.tsx
```

### Barrel Exports

Use `index.tsx` files for clean imports:

```typescript
// app/admin/dugsi/components/dashboard/index.tsx
export { DashboardHeader } from './dashboard-header'
export { DashboardStats } from './dashboard-stats'
export { DashboardFilters } from './dashboard-filters'
```

**Usage**:

```typescript
import { DashboardHeader, DashboardStats } from './components/dashboard'
```

---

## State Management Patterns

### Server State (Default)

**Pattern**: Fetch data in Server Components

```typescript
// Server Component
export default async function Page() {
  const data = await getData()
  return <Component data={data} />
}
```

### Client UI State (Zustand)

**Pattern**: Use Zustand for UI-only state

```typescript
// app/admin/dugsi/store/ui-store.ts
import { create } from 'zustand'

interface DugsiUIStore {
  selectedFamilyKeys: Set<string>
  filters: DugsiFilters
  activeTab: TabValue
  // Actions
  toggleFamilySelection: (key: string) => void
  setSearchQuery: (query: string) => void
}

export const useDugsiUIStore = create<DugsiUIStore>()((set) => ({
  selectedFamilyKeys: new Set(),
  filters: defaultFilters,
  activeTab: 'overview',
  toggleFamilySelection: (key) =>
    set((state) => {
      const newSet = new Set(state.selectedFamilyKeys)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return { selectedFamilyKeys: newSet }
    }),
  setSearchQuery: (query) =>
    set((state) => ({
      filters: { ...state.filters, search: { query } },
    })),
}))
```

**Usage**:

```typescript
'use client'

import { useSelectedFamilies, useLegacyActions } from '../store'

export function Component() {
  const selectedFamilies = useSelectedFamilies()
  const { toggleFamilySelection } = useLegacyActions()

  return (
    <div>
      {selectedFamilies.size} selected
    </div>
  )
}
```

### URL State (Search Params)

**Pattern**: Use `nuqs` for shareable URL state

```typescript
'use client'

import { useQueryStates } from 'nuqs'

export function FilterControls() {
  const [filters, setFilters] = useQueryStates({
    batch: parseAsString,
    date: parseAsString,
  })

  return (
    <Select
      value={filters.batch || ''}
      onValueChange={(value) => setFilters({ batch: value })}
    >
      {/* Options */}
    </Select>
  )
}
```

### Form State (React Hook Form)

**Pattern**: Use React Hook Form for form state

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

export function RegistrationForm() {
  const form = useForm({
    resolver: zodResolver(RegistrationSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  })

  const onSubmit = async (data) => {
    const result = await createRegistration(data)
    if (result.success) {
      toast.success('Registration successful')
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  )
}
```

---

## Error Handling Patterns

### Server Action Error Handling

**Pattern**: Consistent error handling with `ActionResult`

```typescript
// app/admin/dugsi/actions.ts
'use server'

type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  errors?: Partial<Record<string, string[]>>
}

export async function deleteDugsiFamily(
  studentId: string
): Promise<ActionResult> {
  try {
    // Validation
    if (!studentId) {
      return { success: false, error: 'Student ID is required' }
    }

    // Database operation
    await prisma.student.delete({ where: { id: studentId } })

    // Revalidation
    revalidatePath('/admin/dugsi')

    return { success: true }
  } catch (error) {
    return handleActionError(error)
  }
}
```

### Page-Level Error Boundary

**Pattern**: Error boundary for page-level errors

```typescript
// app/admin/dugsi/error.tsx
'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Card className="p-6">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <p className="text-muted-foreground">{error.message}</p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          Go home
        </Button>
      </div>
    </Card>
  )
}
```

### Component-Level Error Handling

**Pattern**: Try-catch in Client Components

```typescript
'use client'

export function Component() {
  const handleAction = async () => {
    try {
      const result = await serverAction()
      if (result.success) {
        toast.success('Success')
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
    }
  }

  return <Button onClick={handleAction}>Action</Button>
}
```

---

## Loading State Patterns

### Suspense with Loading Component

**Pattern**: Dedicated loading component

```typescript
// app/admin/dugsi/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-8 w-64 rounded bg-muted" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-96 rounded-lg bg-muted" />
    </div>
  )
}
```

**Usage**:

```typescript
<Suspense fallback={<Loading />}>
  <Component />
</Suspense>
```

### Inline Loading State

**Pattern**: Loading state within component

```typescript
'use client'

import { useTransition } from 'react'

export function Component() {
  const [isPending, startTransition] = useTransition()

  const handleAction = () => {
    startTransition(async () => {
      await serverAction()
    })
  }

  return (
    <Button onClick={handleAction} disabled={isPending}>
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        'Submit'
      )}
    </Button>
  )
}
```

---

## Form Patterns

### Form with Server Action

**Pattern**: Client Component form with Server Action

```typescript
// app/admin/dugsi/components/forms/create-family-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFamilyAction } from '../../actions'

export function CreateFamilyForm() {
  const form = useForm({
    resolver: zodResolver(CreateFamilySchema),
  })

  const onSubmit = async (data: CreateFamilyInput) => {
    const result = await createFamilyAction(data)
    if (result.success) {
      toast.success('Family created')
      form.reset()
    } else {
      toast.error(result.error)
      // Set form errors
      if (result.errors) {
        Object.entries(result.errors).forEach(([field, messages]) => {
          form.setError(field as keyof CreateFamilyInput, {
            message: messages[0],
          })
        })
      }
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  )
}
```

### Form with Custom Hook

**Pattern**: Extract form logic into custom hook

```typescript
// app/dugsi/register/hooks/use-dugsi-registration.ts
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerDugsiChild } from '../actions'

export function useDugsiRegistration() {
  const form = useForm({
    resolver: zodResolver(DugsiRegistrationSchema),
  })

  const onSubmit = async (data: DugsiRegistrationValues) => {
    const result = await registerDugsiChild(data)
    // Handle result
  }

  return {
    form,
    handleSubmit: form.handleSubmit(onSubmit),
    isPending: form.formState.isSubmitting,
  }
}
```

**Usage**:

```typescript
'use client'

import { useDugsiRegistration } from './hooks/use-dugsi-registration'

export default function RegisterPage() {
  const { form, handleSubmit, isPending } = useDugsiRegistration()

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

---

## Best Practices

### ✅ Do

- Use Server Components by default
- Organize components by feature
- Use barrel exports for clean imports
- Extract complex logic into custom hooks
- Use consistent error handling patterns
- Include loading states
- Use TypeScript for type safety
- Follow naming conventions

### ❌ Don't

- Don't use `'use client'` unless necessary
- Don't mix server and client logic
- Don't fetch data in Client Components
- Don't skip error handling
- Don't skip loading states
- Don't duplicate component logic
- Don't create overly large components

---

## Component Checklist

When creating a new component, ensure:

- [ ] Correct component type (Server vs Client)
- [ ] Proper TypeScript types
- [ ] Error handling (if applicable)
- [ ] Loading states (if applicable)
- [ ] Proper organization (feature-based)
- [ ] Barrel exports (if part of feature group)
- [ ] Consistent naming
- [ ] Documentation (if complex)

---

## Resources

- [React Server Components](https://react.dev/reference/rsc/server-components)
- [React Client Components](https://react.dev/reference/rsc/client-components)
- [Next.js Components](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
- [React Hook Form](https://react-hook-form.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
