# Cursor Rules Documentation

This document provides a portable reference for project rules and best practices that can be copied to other projects. It's designed to be used with Cursor's `.cursorrules` file.

## Quick Setup

1. Copy `.cursorrules` to your new project root
2. Copy this documentation to `docs/CURSOR_RULES.md` (optional)
3. Customize rules for your project's specific needs

---

## Architecture Principles

### 1. Server-First Approach

- Default to Server Components
- Only use Client Components when interactivity is required
- Fetch data in Server Components
- Use Server Actions for mutations

### 2. Domain-Driven Routing

- Organize routes by domain/program rather than feature
- Keep public and admin routes separate
- Use shared routes for cross-domain functionality

### 3. Feature-Based Component Organization

- Group components by feature within routes
- Use barrel exports for clean imports
- Keep components small and focused

---

## Component Patterns

### Server Component Pattern

```typescript
// app/admin/feature/page.tsx
import { Metadata } from 'next'
import { getData } from './actions'

export const metadata: Metadata = {
  title: 'Feature',
  description: 'Feature description',
}

export default async function FeaturePage() {
  const data = await getData()
  return <Component data={data} />
}
```

### Client Component Pattern

```typescript
// app/admin/feature/components/client-component.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function ClientComponent() {
  const [count, setCount] = useState(0)
  return <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>
}
```

### Server Action Pattern

```typescript
// app/admin/feature/actions.ts
'use server'

type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  errors?: Partial<Record<string, string[]>>
}

export async function createItem(data: ItemInput): Promise<ActionResult> {
  try {
    // Validation
    const validated = schema.parse(data)

    // Database operation
    const item = await prisma.item.create({ data: validated })

    // Revalidation
    revalidatePath('/admin/feature')

    return { success: true, data: item }
  } catch (error) {
    return handleActionError(error)
  }
}
```

---

## State Management Patterns

### Server State (Default)

```typescript
// Server Component
export default async function Page() {
  const data = await getData()
  return <Component data={data} />
}
```

### Client UI State (Zustand)

```typescript
// store/ui-store.ts
import { create } from 'zustand'

interface UIStore {
  selectedItems: Set<string>
  filters: Filters
  toggleSelection: (id: string) => void
}

export const useUIStore = create<UIStore>()((set) => ({
  selectedItems: new Set(),
  filters: defaultFilters,
  toggleSelection: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedItems)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return { selectedItems: newSet }
    }),
}))
```

### URL State (nuqs)

```typescript
'use client'

import { useQueryStates } from 'nuqs'
import { parseAsString } from 'nuqs'

export function FilterControls() {
  const [filters, setFilters] = useQueryStates({
    category: parseAsString,
    search: parseAsString,
  })

  return (
    <Select
      value={filters.category || ''}
      onValueChange={(value) => setFilters({ category: value })}
    >
      {/* Options */}
    </Select>
  )
}
```

---

## Error Handling Patterns

### Server Action Error Handling

```typescript
'use server'

export async function deleteItem(id: string): Promise<ActionResult> {
  try {
    if (!id) {
      return { success: false, error: 'ID is required' }
    }

    await prisma.item.delete({ where: { id } })
    revalidatePath('/admin/feature')

    return { success: true }
  } catch (error) {
    return handleActionError(error)
  }
}
```

### Page-Level Error Boundary

```typescript
// app/admin/feature/error.tsx
'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-6">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
```

---

## Loading State Patterns

### Route-Level Loading

```typescript
// app/admin/feature/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-8 w-64 rounded bg-muted" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  )
}
```

### Inline Loading

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
      {isPending ? 'Loading...' : 'Submit'}
    </Button>
  )
}
```

---

## Form Patterns

### Form with Server Action

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createItem } from '../actions'

export function CreateForm() {
  const form = useForm({
    resolver: zodResolver(CreateSchema),
  })

  const onSubmit = async (data: CreateInput) => {
    const result = await createItem(data)
    if (result.success) {
      toast.success('Created successfully')
      form.reset()
    } else {
      toast.error(result.error)
      if (result.errors) {
        Object.entries(result.errors).forEach(([field, messages]) => {
          form.setError(field as keyof CreateInput, {
            message: messages[0],
          })
        })
      }
    }
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>{/* Fields */}</form>
}
```

### Form with Custom Hook

```typescript
// hooks/use-item-form.ts
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createItem } from '../actions'

export function useItemForm() {
  const form = useForm({
    resolver: zodResolver(ItemSchema),
  })

  const onSubmit = async (data: ItemInput) => {
    const result = await createItem(data)
    // Handle result
  }

  return {
    form,
    handleSubmit: form.handleSubmit(onSubmit),
    isPending: form.formState.isSubmitting,
  }
}
```

---

## Code Organization

### Feature-Based Structure

```
app/admin/feature/
├── _types/          # Centralized types
├── _utils/           # Utility functions
├── _queries/         # Prisma select objects
├── _hooks/           # Custom hooks
├── components/       # Feature-based components
│   ├── dashboard/   # Feature-specific
│   ├── forms/       # Form components
│   ├── dialogs/     # Dialog components
│   └── ui/          # Shared UI components
├── store/            # Zustand stores
├── actions.ts        # Server Actions
├── page.tsx          # Route page
├── loading.tsx        # Loading state
└── error.tsx         # Error boundary
```

### Barrel Exports

```typescript
// components/dashboard/index.tsx
export { DashboardHeader } from './dashboard-header'
export { DashboardStats } from './dashboard-stats'
export { DashboardFilters } from './dashboard-filters'
```

---

## Database Patterns

### Prisma Select Objects

```typescript
// _queries/selects.ts
export const ITEM_SELECT = {
  id: true,
  name: true,
  createdAt: true,
  // ... other fields
} satisfies Prisma.ItemSelect

export const ITEM_WITH_RELATIONS_SELECT = {
  ...ITEM_SELECT,
  user: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ItemSelect
```

### Centralized Types

```typescript
// _types/index.ts
import { Prisma } from '@prisma/client'

export type Item = Prisma.ItemGetPayload<{
  select: typeof ITEM_SELECT
}>

export type ItemWithRelations = Prisma.ItemGetPayload<{
  select: typeof ITEM_WITH_RELATIONS_SELECT
}>
```

---

## Testing Patterns

### Unit Tests

```typescript
// _utils/__tests__/format.test.ts
import { describe, it, expect } from 'vitest'
import { formatItemName } from '../format'

describe('formatItemName', () => {
  it('should format item name correctly', () => {
    expect(formatItemName('test')).toBe('Test')
  })
})
```

---

## Best Practices Checklist

When creating a new feature:

- [ ] Use Server Components by default
- [ ] Include proper TypeScript types
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Use consistent naming conventions
- [ ] Organize by feature
- [ ] Use barrel exports
- [ ] Document complex logic
- [ ] Write tests for utilities
- [ ] Follow existing patterns

---

## Common Pitfalls to Avoid

### ❌ Don't

- Don't use 'use client' unless necessary
- Don't fetch data in Client Components
- Don't skip error handling
- Don't skip loading states
- Don't duplicate logic
- Don't create overly large components
- Don't use `any` type
- Don't ignore linting errors

### ✅ Do

- Use Server Components by default
- Fetch data in Server Components
- Always handle errors
- Always include loading states
- Extract reusable logic
- Keep components focused
- Use proper TypeScript types
- Fix linting errors

---

## Migration to New Project

1. **Copy Files**
   - Copy `.cursorrules` to project root
   - Copy `docs/CURSOR_RULES.md` (optional)

2. **Customize**
   - Update technology stack references
   - Adjust database patterns (if not using Prisma)
   - Modify routing patterns (if different framework)
   - Update component library references

3. **Verify**
   - Check that rules align with project structure
   - Ensure rules match your tech stack
   - Update examples to match your patterns

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Shadcn UI](https://ui.shadcn.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
