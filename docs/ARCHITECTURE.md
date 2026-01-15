# Architecture Overview

This document provides a comprehensive overview of the Irshad Center application architecture, focusing on design patterns, data flow, and architectural decisions.

## Table of Contents

1. [Architecture Principles](#architecture-principles)
2. [Technology Stack](#technology-stack)
3. [Application Structure](#application-structure)
4. [Data Flow](#data-flow)
5. [State Management](#state-management)
6. [Error Handling](#error-handling)
7. [Performance Optimizations](#performance-optimizations)

---

## Architecture Principles

### 1. Server-First Approach

**Default to Server Components** - All components are Server Components by default unless interactivity is required.

- ✅ Better performance (smaller bundle size)
- ✅ Better SEO (content rendered on server)
- ✅ Direct database access (no API layer needed)
- ✅ Reduced client-side JavaScript

### 2. Domain-Driven Routing

Routes are organized by domain/program rather than feature:

```
/mahad           # Public Mahad program pages
/dugsi           # Public Dugsi program pages
/admin/mahad     # Mahad admin functionality
/admin/dugsi     # Dugsi admin functionality
/admin/shared    # Shared admin functionality
```

### 3. Feature-Based Component Organization

Within each route, components are organized by feature:

```
app/admin/dugsi/
├── components/
│   ├── dashboard/        # Dashboard-specific components
│   ├── family-management/ # Family-related features
│   ├── registrations/    # Registration table features
│   ├── dialogs/         # All dialog components
│   ├── quick-actions/   # Bulk action components
│   └── ui/              # Shared UI components
```

### 4. Centralized Type Definitions

Types, utilities, and queries are centralized in feature-specific directories:

```
app/admin/dugsi/
├── _types/       # TypeScript type definitions
├── _utils/        # Utility functions
├── _queries/      # Prisma select objects
└── _hooks/        # Custom React hooks
```

---

## Technology Stack

### Core Framework

- **Next.js 15** - React framework with App Router
- **React 19** - UI library with Server Components
- **TypeScript** - Type-safe JavaScript

### UI & Styling

- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/UI** - High-quality React components
- **Radix UI** - Accessible component primitives
- **Framer Motion** - Animation library

### State Management

- **Zustand** - Lightweight state management (for UI-only state)
- **React Server Components** - Server-side state (default)
- **URL Search Params** - Client-side URL state (via `nuqs`)

### Data Layer

- **Prisma** - Type-safe database ORM
- **PostgreSQL** - Relational database
- **Server Actions** - Server-side data mutations

### Payments & External Services

- **Stripe** - Payment processing
- **Next-Intl** - Internationalization

---

## Application Structure

```
irshad-center/
├── app/                          # Next.js App Router
│   ├── mahad/                   # Public Mahad program
│   │   ├── page.tsx            # Landing page
│   │   └── register/           # Registration flow
│   ├── dugsi/                   # Public Dugsi program
│   │   ├── page.tsx            # Landing page
│   │   └── register/           # Registration flow
│   ├── admin/                   # Admin routes
│   │   ├── mahad/              # Mahad admin
│   │   │   └── cohorts/        # Cohort management
│   │   ├── dugsi/              # Dugsi admin
│   │   │   ├── _types/         # Centralized types
│   │   │   ├── _utils/         # Utility functions
│   │   │   ├── _queries/       # Prisma selects
│   │   │   ├── _hooks/         # Custom hooks
│   │   │   ├── components/     # Feature-based components
│   │   │   └── store/          # Zustand store
│   │   └── shared/             # Shared admin features
│   │       └── attendance/     # Attendance tracking
│   └── api/                     # API routes
│       └── webhook/            # Stripe webhooks
├── components/                  # Shared components
│   ├── ui/                     # Shadcn UI components
│   └── layout/                 # Layout components
├── lib/                         # Utilities and configs
│   ├── db/                     # Database utilities
│   ├── utils/                  # Helper functions
│   ├── validations/            # Zod schemas
│   └── stripe-*.ts            # Stripe utilities
├── prisma/                      # Database schema
└── docs/                        # Documentation
```

---

## Data Flow

### 1. Server Component Data Fetching

**Pattern**: Server Components fetch data directly from the database

```typescript
// app/admin/dugsi/page.tsx
export default async function DugsiAdminPage() {
  // Parallel data fetching for consolidated dashboard
  const [registrations, teachersResult, classesResult, classTeachersResult] =
    await Promise.all([
      getDugsiRegistrations({ shift }),
      getTeachers('DUGSI_PROGRAM'),
      getClassesWithDetailsAction(),
      getAllTeachersForClassAssignmentAction(),
    ])

  return (
    <ConsolidatedDugsiDashboard
      registrations={registrations}
      teachers={teachersResult.data ?? []}
      classes={classesResult.data ?? []}
      classTeachers={classTeachersResult.data ?? []}
    />
  )
}
```

**Benefits**:

- No API layer needed
- Type-safe database queries
- Optimal performance (no client-side data fetching)

### 2. Server Actions for Mutations

**Pattern**: Client Components call Server Actions for data mutations

```typescript
// app/admin/dugsi/actions.ts
'use server'

export async function deleteDugsiFamily(studentId: string) {
  // Validation
  // Database mutation
  // Revalidation
  revalidatePath('/admin/dugsi')
  return { success: true }
}
```

**Benefits**:

- Built-in validation with Zod
- Automatic revalidation
- Type-safe mutations

### 3. Parallel Data Fetching

**Pattern**: Fetch multiple data sources in parallel

```typescript
// app/admin/mahad/page.tsx
const [batches, students, duplicates] = await Promise.all([
  getBatches(),
  getStudentsWithBatch(),
  findDuplicateStudents(),
])
```

**Benefits**:

- Faster page loads
- Better user experience

---

## State Management

### Server State (Default)

**Server Components** handle server state by default:

- Data fetched on the server
- No client-side state management needed
- Automatic revalidation via Server Actions

### Client UI State

**Zustand** is used for UI-only state:

```typescript
// app/admin/dugsi/store/ui-store.ts
export const useDugsiUIStore = create<DugsiUIStore>()(
  immer((set) => ({
    selectedFamilyKeys: new Set<string>(),
    filters: defaultFilters,
    activeTab: 'overview',
    // ...
  }))
)
```

**When to use**:

- ✅ Filter state
- ✅ Selection state
- ✅ Dialog open/close state
- ✅ View mode (grid/table)
- ❌ Server data (use Server Components)
- ❌ Form state (use React Hook Form)

### URL State

**URL Search Params** for shareable filter state:

```typescript
// Using nuqs for URL state management
const [searchParams, setSearchParams] = useQueryStates({
  batch: parseAsString,
  date: parseAsString,
})
```

**Benefits**:

- Shareable URLs
- Browser back/forward support
- Server Component compatible

---

## Error Handling

### Consistent Error Pattern

All Server Actions follow a consistent error handling pattern:

```typescript
// app/admin/mahad/_actions/index.ts
type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  errors?: Partial<Record<string, string[]>>
}

export async function createBatchAction(
  formData: FormData
): Promise<ActionResult<Batch>> {
  try {
    // Validation
    const validated = CreateBatchSchema.parse(...)

    // Database operation
    const batch = await createBatch(validated)

    // Revalidation
    revalidatePath('/admin/mahad')

    return { success: true, data: batch }
  } catch (error) {
    return handleActionError(error)
  }
}
```

### Error Boundaries

**Page-level error boundaries** for graceful error handling:

```typescript
// app/admin/dugsi/error.tsx
export default function Error({ error, reset }: ErrorProps) {
  return (
    <Card>
      <AlertCircle />
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </Card>
  )
}
```

### Loading States

**Suspense boundaries** with loading skeletons:

```typescript
// app/admin/dugsi/page.tsx
<Suspense fallback={<Loading />}>
  <ConsolidatedDugsiDashboard
    registrations={registrations}
    teachers={teachersResult.data ?? []}
    classes={classesResult.data ?? []}
    classTeachers={classTeachersResult.data ?? []}
  />
</Suspense>
```

---

## Performance Optimizations

### 1. Server Components (Default)

- ✅ Smaller bundle size (no client-side code)
- ✅ Faster initial page load
- ✅ Better SEO

### 2. Parallel Data Fetching

```typescript
const [data1, data2, data3] = await Promise.all([
  fetchData1(),
  fetchData2(),
  fetchData3(),
])
```

### 3. Suspense Boundaries

Break pages into smaller Suspense boundaries for incremental loading:

```typescript
<Suspense fallback={<Loading />}>
  <Section1 />
</Suspense>
<Suspense fallback={<Loading />}>
  <Section2 />
</Suspense>
```

### 4. Prisma Select Objects

Only fetch needed fields:

```typescript
// app/admin/dugsi/_queries/selects.ts
export const DUGSI_REGISTRATION_SELECT = {
  id: true,
  name: true,
  parentEmail: true,
  // ... only needed fields
} as const
```

### 5. Code Splitting

- Dynamic imports for non-critical components
- Route-based code splitting (automatic with Next.js)

---

## Best Practices

### ✅ Do

- Use Server Components by default
- Fetch data in Server Components
- Use Server Actions for mutations
- Centralize types and utilities
- Organize components by feature
- Use Suspense boundaries for loading states
- Use Error Boundaries for error handling
- Follow consistent naming conventions

### ❌ Don't

- Don't use `'use client'` unless necessary
- Don't fetch data in Client Components
- Don't duplicate type definitions
- Don't mix server and client logic
- Don't skip error handling
- Don't skip loading states

---

## Migration Guide

### Migrating from Old Patterns

#### Old: API Routes + Client Components

```typescript
// ❌ Old pattern
'use client'
const [data, setData] = useState([])
useEffect(() => {
  fetch('/api/data')
    .then((res) => res.json())
    .then(setData)
}, [])
```

#### New: Server Components + Server Actions

```typescript
// ✅ New pattern
export default async function Page() {
  const data = await getData()
  return <Component data={data} />
}
```

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
