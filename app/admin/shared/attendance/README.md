# Weekend Attendance System

## Architecture

This module follows a **Server Components + Server Actions** pattern for optimal performance and maintainability.

### Current Structure

```
attendance/
├── _types/                    # TypeScript type definitions
├── actions.ts                 # Server actions for data mutations
├── page.tsx                   # Main page (Server Component)
├── layout.tsx                 # Layout with metadata
├── components/
│   ├── attendance-management.tsx    # Main table (Server Component)
│   ├── attendance-stats.tsx         # Dashboard stats (Server Component)
│   ├── create-session-dialog.tsx    # Create sessions (Client + Server Action)
│   ├── mark-attendance-dialog.tsx   # Mark attendance (Client + Server Action)
│   ├── filter-controls/             # URL-based filtering (Client Component)
│   └── skeletons/                   # Loading states
└── _tests/                    # Test utilities
```

## Architecture Principles

### ✅ Server Components (Default)

- Use for data fetching and display
- Direct Prisma calls for database access
- Better SEO, performance, and bundle size
- Examples: `attendance-management.tsx`, `attendance-stats.tsx`

### ⚙️ Server Actions

- Use for all data mutations (create, update, delete)
- Built-in validation with Zod schemas
- Automatic revalidation with `revalidatePath`
- Examples: `createSession`, `markAttendance`, `deleteSession`

### 🎛️ Client Components (Minimal)

- Only for interactivity and user input
- Form submissions and URL state management
- Examples: `FilterControls`, dialog components

## Data Flow

1. **Page loads** → Server Component fetches data via Prisma
2. **User filters** → Client Component updates URL search params
3. **Page reloads** → Server Component uses new params for filtering
4. **User submits** → Client Component calls Server Action
5. **Server Action** → Validates, updates DB, revalidates page

## Type System

- **Source of Truth**: Prisma-generated types (`@prisma/client`)
- **Re-exports**: Local types in `_types/index.ts` extend Prisma types
- **Consistency**: All components use the same type definitions

## Development Guidelines

### ✅ Do

- Use Server Components for data display
- Use Server Actions for forms and mutations
- Direct Prisma calls in Server Components
- URL search params for filtering
- Zod validation in Server Actions

### ❌ Don't

- Mix Server/Client patterns unnecessarily
- Use React Query with Server Components
- Create API routes for simple CRUD operations
- Client-side data fetching for server-rendered data

## File Conventions

- **Server Components**: No `'use client'` directive
- **Client Components**: Start with `'use client'`
- **Server Actions**: Start with `'use server'`
- **Types**: Use Prisma types, extend in `_types/` if needed

## Testing

- Test utilities in `_tests/test-utils.tsx`
- Focus on integration over unit tests
- Test Server Actions with real database calls
- Mock external dependencies only

## Performance

- ✅ **Server-side rendering** for better SEO/performance
- ✅ **Minimal client JavaScript** for faster page loads
- ✅ **Streaming with Suspense** for loading states
- ✅ **Optimized bundle size** with Server Components
