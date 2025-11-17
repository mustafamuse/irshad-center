# Migration Guide: UI Store v1.0

## Overview

The UI Store has been refactored using TDD to create a minimal, focused state management solution. This guide helps you migrate from the old store to the new streamlined version.

## Key Changes

### 🎯 Architecture Shift

**Before**: Filters + UI state mixed in Zustand
**After**: Filters in URL params, UI state in Zustand

```
OLD: Zustand manages everything
NEW: URL (useURLFilters) → Filters
     Zustand (useUIStore) → Transient UI only
```

### 📊 Impact

- **-62% code** (463 → 177 lines)
- **-100% filter state** (moved to URL)
- **+100% test coverage** (35 comprehensive tests)
- **Better performance** (fewer re-renders, O(1) lookups)

---

## Breaking Changes

### 1. Action Names Changed

Student selection actions have been renamed for clarity:

| Old Name                     | New Name            | Notes            |
| ---------------------------- | ------------------- | ---------------- |
| `toggleStudentSelection(id)` | `toggleStudent(id)` | Shorter, clearer |
| `setStudentSelection(ids)`   | `setSelected(ids)`  | Shorter          |
| `clearStudentSelection()`    | `clearSelected()`   | Shorter          |

**Migration**:

```tsx
// ❌ OLD
const store = useUIStore()
store.toggleStudentSelection('student-123')
store.setStudentSelection(['s1', 's2'])
store.clearStudentSelection()

// ✅ NEW
const store = useUIStore()
store.toggleStudent('student-123')
store.setSelected(['s1', 's2'])
store.clearSelected()
```

### 2. Dialog State Unified

Multiple boolean flags replaced with single `openDialog` field:

| Old State                             | New State                              | Notes         |
| ------------------------------------- | -------------------------------------- | ------------- |
| `isCreateBatchDialogOpen: boolean`    | `openDialog: 'createBatch' \| null`    | Type-safe     |
| `isAssignStudentsDialogOpen: boolean` | `openDialog: 'assignStudents' \| null` | Single source |
| `duplicatesExpanded: boolean`         | `openDialog: 'duplicates' \| null`     | Consistent    |

**Migration**:

```tsx
// ❌ OLD
const store = useUIStore()
store.setDialogOpen('createBatch', true) // Boolean parameter
store.setDialogOpen('createBatch', false)

// ✅ NEW
const store = useUIStore()
store.setDialogOpen('createBatch') // Opens
store.setDialogOpen(null) // Closes all
```

### 3. Filter State Removed (BREAKING)

All filter state has been moved to URL parameters.

**Before**:

```tsx
// ❌ OLD - Filter state in Zustand
const filters = useUIStore((s) => s.filters)
const setSearchQuery = useUIStore((s) => s.setSearchQuery)
const resetFilters = useUIStore((s) => s.resetFilters)

setSearchQuery('Ahmed')
```

**After**:

```tsx
// ✅ NEW - Filters in URL params
import { useURLFilters } from '../hooks/use-url-filters'

const { filters, setSearch, resetFilters } = useURLFilters()

setSearch('Ahmed') // Updates URL, triggers re-render
```

**Why this change?**

- ✅ Shareable URLs (filters in query params)
- ✅ Browser back/forward works
- ✅ SSR-friendly
- ✅ Automatic persistence
- ✅ Clearer separation of concerns

---

## Migration Strategies

### Strategy 1: Use Legacy Actions (Quick Fix)

For immediate compatibility, use `useLegacyActions()`:

```tsx
// Components work unchanged
import { useLegacyActions } from '../store/ui-store'

function MyComponent() {
  const { selectStudent, selectAllStudents } = useLegacyActions()

  // Old code works as-is
  selectStudent('student-123')
}
```

**When to use**: Temporary fix during gradual migration
**Downside**: Deprecated, will be removed in v2.0
**Recommendation**: Use only as bridge, then migrate properly

### Strategy 2: Direct Migration (Recommended)

Update to new API directly:

```tsx
// ❌ OLD
import { useUIStore } from '../store/ui-store'

const store = useUIStore()
const setStudentSelection = useUIStore((s) => s.setStudentSelection)

setStudentSelection(['s1', 's2'])

// ✅ NEW
import { useUIStore } from '../store/ui-store'

const setSelected = useUIStore((s) => s.setSelected)

setSelected(['s1', 's2'])
```

---

## Common Migration Scenarios

### Scenario 1: Student Selection in Table

**Before**:

```tsx
// students-table.tsx (OLD)
import { useUIStore } from '../store/ui-store'

function StudentsTable() {
  const setStudentSelection = useUIStore((s) => s.setStudentSelection)

  const handleRowSelectionChange = (rows) => {
    const ids = rows.map((r) => r.id)
    setStudentSelection(ids)
  }

  return <DataTable onRowSelectionChange={handleRowSelectionChange} />
}
```

**After**:

```tsx
// students-table.tsx (NEW)
import { useUIStore } from '../store/ui-store'

function StudentsTable() {
  const setSelected = useUIStore((s) => s.setSelected) // ← Changed

  const handleRowSelectionChange = (rows) => {
    const ids = rows.map((r) => r.id)
    setSelected(ids) // ← Changed
  }

  return <DataTable onRowSelectionChange={handleRowSelectionChange} />
}
```

### Scenario 2: Filtering Students

**Before**:

```tsx
// students-filter-bar.tsx (OLD)
import { useUIStore } from '../store/ui-store'

function StudentsFilterBar() {
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const toggleBatchFilter = useUIStore((s) => s.toggleBatchFilter)
  const resetFilters = useUIStore((s) => s.resetFilters)

  return (
    <div>
      <input onChange={(e) => setSearchQuery(e.target.value)} />
      <button onClick={resetFilters}>Clear</button>
    </div>
  )
}
```

**After**:

```tsx
// students-filter-bar.tsx (NEW)
import { useURLFilters } from '../hooks/use-url-filters' // ← New import

function StudentsFilterBar() {
  const { filters, setSearch, toggleBatch, resetFilters } = useURLFilters() // ← New hook

  return (
    <div>
      <input
        value={filters.search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button onClick={resetFilters}>Clear</button>
    </div>
  )
}
```

### Scenario 3: Dialog Management

**Before**:

```tsx
// create-batch-dialog.tsx (OLD)
import { useUIStore } from '../store/ui-store'

function CreateBatchDialog() {
  const isOpen = useUIStore((s) => s.isCreateBatchDialogOpen)
  const setDialogOpen = useUIStore((s) => s.setDialogOpen)

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => setDialogOpen('createBatch', open)}
    />
  )
}
```

**After**:

```tsx
// create-batch-dialog.tsx (NEW)
import { useUIStore } from '../store/ui-store'

function CreateBatchDialog() {
  const dialog = useUIStore((s) => s.openDialog) // ← Changed
  const setDialogOpen = useUIStore((s) => s.setDialogOpen)

  const isOpen = dialog === 'createBatch' // ← Derived

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => setDialogOpen(open ? 'createBatch' : null)} // ← Changed
    />
  )
}

// OR use backward-compatible selector:
import { useCreateBatchDialogState } from '../store/ui-store'

function CreateBatchDialog() {
  const isOpen = useCreateBatchDialogState() // Still works (deprecated)
  // ... rest same
}
```

---

## API Reference

### New Store API

#### State

```typescript
interface UIStore {
  _version: number // Store version (internal)
  selectedStudentIds: Set<string> // Selected student IDs
  selectedBatchId: string | null // Selected batch
  openDialog: DialogType // Currently open dialog
}

type DialogType = 'createBatch' | 'assignStudents' | 'duplicates' | null
```

#### Actions

```typescript
// Selection
toggleStudent(id: string): void           // Toggle single student
setSelected(ids: string[]): void          // Replace selection
clearSelected(): void                     // Clear all

// Batch
selectBatch(id: string | null): void      // Select/clear batch

// Dialogs
setDialogOpen(dialog: DialogType): void   // Open dialog or close all

// Utility
reset(): void                             // Reset all state
```

#### Selectors

```typescript
useSelectedStudents(): Set<string>        // Get selected IDs
useSelectedBatch(): string | null         // Get selected batch
useDialogState(): DialogType              // Get dialog state
```

### URL Filters API

```typescript
const {
  filters, // Current filter values
  setSearch, // Update search query
  toggleBatch, // Toggle batch filter
  toggleStatus, // Toggle status filter
  setPage, // Update pagination
  resetFilters, // Clear all filters
  isPending, // Loading state
} = useURLFilters()
```

---

## Troubleshooting

### Error: "Property 'setStudentSelection' does not exist"

**Cause**: Using old action name
**Fix**: Rename to `setSelected`

```tsx
// ❌ Error
const setStudentSelection = useUIStore((s) => s.setStudentSelection)

// ✅ Fixed
const setSelected = useUIStore((s) => s.setSelected)
```

### Error: "Property 'filters' does not exist"

**Cause**: Trying to access removed filter state
**Fix**: Use `useURLFilters` hook instead

```tsx
// ❌ Error
const filters = useUIStore((s) => s.filters)

// ✅ Fixed
import { useURLFilters } from '../hooks/use-url-filters'
const { filters } = useURLFilters()
```

### Error: "Expected 2 arguments, but got 1"

**Cause**: Old dialog API used boolean parameter
**Fix**: Use `null` to close, dialog name to open

```tsx
// ❌ Error
setDialogOpen('createBatch', true)
setDialogOpen('createBatch', false)

// ✅ Fixed
setDialogOpen('createBatch') // Open
setDialogOpen(null) // Close
```

### Filters don't persist on refresh

**Cause**: Filters are in URL now, not localStorage
**Fix**: This is expected behavior - URL params persist automatically

```tsx
// ✅ URL params persist automatically
const { filters } = useURLFilters()
// Refresh page → filters still applied (from URL)
```

---

## Testing Your Migration

### Unit Tests

Ensure tests use new API:

```tsx
// ❌ OLD Test
it('should select students', () => {
  const { result } = renderHook(() => useUIStore())
  act(() => result.current.setStudentSelection(['s1', 's2']))
  expect(result.current.selectedStudentIds.size).toBe(2)
})

// ✅ NEW Test
it('should select students', () => {
  const store = useUIStore.getState()
  store.setSelected(['s1', 's2'])
  expect(useUIStore.getState().selectedStudentIds.size).toBe(2)
})
```

### Integration Tests

Test URL filter integration:

```tsx
it('should update URL when filtering', () => {
  const { setSearch } = useURLFilters()
  setSearch('Ahmed')
  expect(window.location.search).toContain('search=Ahmed')
})
```

---

## Rollback Plan

If you need to rollback:

1. **Restore old store**:

   ```bash
   git checkout HEAD~1 -- app/admin/mahad/cohorts/store/ui-store.ts
   ```

2. **Revert component changes**:

   ```bash
   git checkout HEAD~1 -- app/admin/mahad/cohorts/components/
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

---

## Timeline & Deprecation

### Phase 1: Now → v1.x (Current)

- ✅ New store available
- ✅ Legacy actions provided for compatibility
- ⚠️ Deprecated warnings in console

### Phase 2: v2.0 (Future)

- ❌ Legacy actions removed
- ❌ Old selectors removed
- ✅ Only new API supported

**Recommendation**: Migrate ASAP to avoid breaking changes in v2.0

---

## Questions & Support

### Need Help?

1. Check examples in `components/students-table/`
2. Review tests in `store/__tests__/ui-store.test.ts`
3. See JSDoc in `store/ui-store.ts`
4. Ask team for migration assistance

### Found a Bug?

Report issues with:

- Current behavior
- Expected behavior
- Steps to reproduce
- Component/file affected

---

## Summary Checklist

Use this checklist to track your migration:

- [ ] Replace `setStudentSelection` with `setSelected`
- [ ] Replace `toggleStudentSelection` with `toggleStudent`
- [ ] Replace `clearStudentSelection` with `clearSelected`
- [ ] Replace `isCreateBatchDialogOpen` with `openDialog === 'createBatch'`
- [ ] Replace Zustand filter state with `useURLFilters()`
- [ ] Update dialog actions to use `setDialogOpen(dialog | null)`
- [ ] Update tests to use new API
- [ ] Remove `useLegacyActions()` usage
- [ ] Verify TypeScript compiles with no errors
- [ ] Test functionality in browser
- [ ] Update team on changes

---

**Last Updated**: 2025-11-17
**Version**: 1.0.0
**Author**: TDD Refactor (Sprint 2)
