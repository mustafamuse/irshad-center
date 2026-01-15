# Routing Structure

This document describes the routing structure and organization principles for the Irshad Center application.

## Table of Contents

1. [Routing Philosophy](#routing-philosophy)
2. [Route Structure](#route-structure)
3. [Public Routes](#public-routes)
4. [Admin Routes](#admin-routes)
5. [Route Organization](#route-organization)
6. [Route Patterns](#route-patterns)

---

## Routing Philosophy

### Domain-Driven Design

Routes are organized by **domain/program** rather than by feature. This reflects the fact that the application serves two distinct programs:

- **Mahad** - College-level Islamic education program
- **Dugsi** - K-12 Islamic education program

Each program has:

- Public-facing pages (landing, registration)
- Admin pages (management, tracking)
- Shared functionality (attendance, payments)

---

## Route Structure

```
/                          # Public homepage
├── /mahad                 # Public Mahad program
│   ├── /                  # Landing page
│   └── /register          # Registration flow
├── /dugsi                 # Public Dugsi program
│   ├── /                  # Landing page
│   └── /register          # Registration flow
└── /admin                 # Admin routes
    ├── /mahad             # Mahad admin
    │   └── /cohorts       # Cohort management
    ├── /dugsi             # Dugsi admin
    │   └── /              # Dashboard
    ├── /shared            # Shared admin features
    │   └── /attendance    # Attendance tracking
    ├── /payments          # Payment management
    ├── /link-subscriptions # Subscription linking
    └── /profit-share      # Financial calculations
```

---

## Public Routes

### Mahad Program (`/mahad`)

**Purpose**: Public-facing pages for the Mahad program

**Routes**:

- `/mahad` - Landing page with program information
- `/mahad/register` - Student registration flow

**Structure**:

```
app/mahad/
├── page.tsx              # Landing page
├── layout.tsx            # Program-specific layout
└── register/
    ├── page.tsx          # Registration form
    ├── actions.ts        # Server Actions
    └── hooks/            # Registration hooks
```

**Features**:

- Program-specific branding
- Registration flow with payment integration
- Public accessibility (no auth required)

### Dugsi Program (`/dugsi`)

**Purpose**: Public-facing pages for the Dugsi program

**Routes**:

- `/dugsi` - Landing page with program information
- `/dugsi/register` - Child registration flow

**Structure**:

```
app/dugsi/
├── page.tsx              # Landing page
├── layout.tsx            # Program-specific layout
└── register/
    ├── page.tsx          # Registration form
    ├── actions.ts        # Server Actions
    └── hooks/            # Registration hooks
```

**Features**:

- Age-appropriate content (5 to teens)
- Parent-led registration
- Payment link generation

---

## Admin Routes

### Mahad Admin (`/admin/mahad`)

**Purpose**: Admin functionality specific to the Mahad program

**Routes**:

- `/admin/mahad` - Student and cohort (batch) management dashboard

**Structure**:

```
app/admin/mahad/
├── page.tsx              # Main page (Server Component)
├── _actions/             # Server Actions
├── components/           # Feature-based components
├── store/                # Zustand store
├── _hooks/               # Custom hooks
└── README.md             # Documentation
```

**Features**:

- Create and manage cohorts
- Assign students to cohorts
- Transfer students between cohorts
- Student management

**Access Control**: Admin authentication required

### Dugsi Admin (`/admin/dugsi`)

**Purpose**: Admin functionality specific to the Dugsi program

**Routes**:

- `/admin/dugsi` - Dashboard with family management

**Structure**:

```
app/admin/dugsi/
├── page.tsx              # Main page (Server Component)
├── actions.ts            # Server Actions
├── _types/               # Centralized types
├── _utils/               # Utility functions
├── _queries/             # Prisma select objects
├── _hooks/               # Custom hooks
├── components/           # Feature-based components
│   ├── dashboard/        # Dashboard components
│   ├── family-management/ # Family features
│   ├── registrations/    # Registration table
│   ├── dialogs/          # Dialog components
│   ├── quick-actions/    # Bulk actions
│   └── ui/               # Shared UI components
└── store/                # Zustand store
```

**Features**:

- Family grouping and management
- Registration tracking
- Payment status management
- Subscription linking
- Bulk actions (future)

**Access Control**: Admin authentication required

### Shared Admin (`/admin/shared`)

**Purpose**: Admin functionality that spans both programs

**Routes**:

- `/admin/shared/attendance` - Attendance tracking for both programs

**Structure**:

```
app/admin/shared/
├── attendance/
│   ├── page.tsx          # Main page
│   ├── actions.ts        # Server Actions
│   ├── components/        # Components
│   └── README.md         # Documentation
└── README.md             # Overview
```

**Features**:

- Cross-program attendance tracking
- Batch-based attendance sessions
- Filtering by program/batch/date

**Access Control**: Admin authentication required

**Note**: Currently not fully functional, needs fixing

### Root Admin Routes

**Purpose**: Admin functionality at the root level

**Routes**:

- `/admin/payments` - Payment management across programs
- `/admin/link-subscriptions` - Subscription linking tool
- `/admin/profit-share` - Financial calculations

---

## Route Organization

### File-Based Routing

Next.js App Router uses file-based routing:

```
app/
├── page.tsx              → /
├── mahad/
│   └── page.tsx          → /mahad
└── admin/
    └── dugsi/
        └── page.tsx      → /admin/dugsi
```

### Route Groups

Route groups (folders with parentheses) are used for organization without affecting URLs:

```
app/
├── (public)/             # Public routes (no URL segment)
│   ├── mahad/
│   └── dugsi/
└── (admin)/              # Admin routes (no URL segment)
    └── admin/
```

**Note**: Currently not used, but could be added for better organization

### Dynamic Routes

Dynamic routes use brackets:

```
app/
└── api/
    └── webhook/
        └── [type]/
            └── route.ts  → /api/webhook/[type]
```

---

## Route Patterns

### Pattern 1: Server Component Page

**Standard pattern** for admin pages:

```typescript
// app/admin/dugsi/page.tsx
import { Metadata } from 'next'
import { Suspense } from 'react'

import { AppErrorBoundary } from '@/components/error-boundary'
import { ShiftFilterSchema } from '@/lib/validations/dugsi'
import {
  getDugsiRegistrations,
  getClassesWithDetailsAction,
  getAllTeachersForClassAssignmentAction,
} from './actions'
import { ConsolidatedDugsiDashboard } from './components/consolidated-dugsi-dashboard'
import { getTeachers } from './teachers/actions'

export const metadata: Metadata = {
  title: 'Dugsi Admin',
  description: 'Manage Dugsi program registrations',
}

export default async function DugsiAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ shift?: string }>
}) {
  const params = await searchParams
  const shift = ShiftFilterSchema.parse(params?.shift)

  const [registrations, teachersResult, classesResult, classTeachersResult] =
    await Promise.all([
      getDugsiRegistrations({ shift }),
      getTeachers('DUGSI_PROGRAM'),
      getClassesWithDetailsAction(),
      getAllTeachersForClassAssignmentAction(),
    ])

  return (
    <AppErrorBoundary
      context="Dugsi admin dashboard"
      variant="card"
      fallbackUrl="/admin/dugsi"
      fallbackLabel="Reload Dashboard"
    >
      <Suspense fallback={<Loading />}>
        <ConsolidatedDugsiDashboard
          registrations={registrations}
          teachers={teachersResult.data ?? []}
          classes={classesResult.data ?? []}
          classTeachers={classTeachersResult.data ?? []}
        />
      </Suspense>
    </AppErrorBoundary>
  )
}
```

**Features**:

- ✅ Server Component (default)
- ✅ Metadata for SEO
- ✅ Suspense boundaries
- ✅ Error boundaries

### Pattern 2: Public Landing Page

**Standard pattern** for public pages:

```typescript
// app/dugsi/page.tsx
'use client' // Only if animations/interactivity needed

import { motion } from 'framer-motion'

export default function DugsiPage() {
  return (
    <div>
      {/* Hero section */}
      {/* Features */}
      {/* CTA */}
    </div>
  )
}
```

**Features**:

- ✅ Client Component only if needed (animations, interactivity)
- ✅ SEO-friendly content
- ✅ Responsive design

### Pattern 3: Registration Flow

**Standard pattern** for registration:

```typescript
// app/dugsi/register/page.tsx
'use client'

import { useDugsiRegistration } from './hooks/use-dugsi-registration'

export default function DugsiRegisterPage() {
  const { form, handleSubmit, isPending } = useDugsiRegistration()

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

**Features**:

- ✅ Client Component (form interactivity)
- ✅ Custom hooks for logic
- ✅ Server Actions for submission

---

## Route Redirects

### Permanent Redirects

Old routes redirect to new routes:

```typescript
// app/batches/page.tsx
import { permanentRedirect } from 'next/navigation'

export default function BatchesRedirect() {
  permanentRedirect('/admin/mahad/cohorts')
}
```

**Redirects**:

- `/batches` → `/admin/mahad/cohorts`
- `/admin/attendance` → `/admin/shared/attendance`

---

## Route Metadata

### Page Metadata

All pages should include metadata:

```typescript
export const metadata: Metadata = {
  title: 'Page Title',
  description: 'Page description',
}
```

### Layout Metadata

Layouts can define default metadata:

```typescript
// app/admin/layout.tsx
export const metadata: Metadata = {
  title: {
    default: 'Admin Dashboard',
    template: '%s | Admin',
  },
}
```

---

## Navigation

### Global Header

Navigation links are centralized:

```typescript
// components/layout/global-header.tsx
<Link href="/admin/shared/attendance">Attendance</Link>
<Link href="/admin/payments">Payments</Link>
```

### Program-Specific Navigation

Each program can have its own navigation:

```typescript
// app/mahad/_components/nav.tsx
<Link href="/mahad">Home</Link>
<Link href="/mahad/register">Register</Link>
```

---

## Best Practices

### ✅ Do

- Organize routes by domain/program
- Use Server Components for pages
- Include metadata for SEO
- Use Suspense boundaries
- Use Error Boundaries
- Follow consistent naming conventions

### ❌ Don't

- Don't nest routes unnecessarily
- Don't mix program-specific and shared routes
- Don't skip error handling
- Don't skip loading states
- Don't create routes without documentation

---

## Migration History

### Phase 2: `/batches` → `/admin/mahad/cohorts`

**Date**: 2025-01-XX  
**Reason**: Better organization, clearer naming  
**Status**: ✅ Completed

### Phase 3: `/admin/attendance` → `/admin/shared/attendance`

**Date**: 2025-01-XX  
**Reason**: Reflects shared nature across programs  
**Status**: ✅ Completed

---

## Future Considerations

### Potential Improvements

1. **Route Groups**: Use `(public)` and `(admin)` groups for better organization
2. **Middleware**: Enhance route protection with better middleware
3. **Internationalization**: Add locale-based routing (`/en/mahad`, `/ar/mahad`)
4. **Route Aliases**: Add aliases for common routes

---

## Resources

- [Next.js Routing](https://nextjs.org/docs/app/building-your-application/routing)
- [Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [Metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
