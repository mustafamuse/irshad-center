# Mahad Cohorts - API Documentation

## Server Actions

All server actions are located in `app/admin/mahad/cohorts/actions.ts` and use Next.js Server Actions for type-safe mutations.

---

## Student Management Actions

### `updateStudentAction(studentId, data)`

Updates an existing student record.

**Parameters:**

- `studentId` (string) - Student ID to update
- `data` (StudentUpdateData) - Fields to update

**Returns:**

```typescript
{
  success: boolean
  error?: string
}
```

**Example:**

```typescript
const result = await updateStudentAction('student-123', {
  name: 'Ahmed Mohamed',
  email: 'ahmed@example.com',
  batchId: 'batch-456',
})
```

**Validation:**

- Name: Required, min 2 characters
- Email: Optional, must be unique, valid format
- Phone: Optional, must be unique, E.164 format
- MonthlyRate: Number, min 0

**Error Handling:**

- `P2002`: Duplicate email/phone
- Returns user-friendly messages

---

### `deleteStudentsAction(studentIds)`

Deletes multiple students (supports bulk operations).

**Parameters:**

- `studentIds` (string[]) - Array of student IDs to delete

**Returns:**

```typescript
{
  success: boolean
  error?: string
  deleted?: number
}
```

**Safety Checks:**

- Checks for sibling groups (warns if deleting all siblings)
- Checks for attendance records (warns if student has attendance)
- Revalidates affected batches

**Example:**

```typescript
const result = await deleteStudentsAction(['student-1', 'student-2'])
// { success: true, deleted: 2 }
```

---

## Batch Management Actions

### `createBatchAction(formData)`

Creates a new batch (cohort).

**Parameters:**

- `formData` (FormData) - Contains `name` field

**Returns:**

```typescript
{
  success: boolean
  error?: string
  batch?: { id: string, name: string }
}
```

**Validation:**

- Name: Required, must be unique
- Auto-assigns start/end dates (null initially)

**Example:**

```typescript
const formData = new FormData()
formData.append('name', 'Irshad 4S')

const result = await createBatchAction(formData)
```

---

### `deleteBatchAction(batchId)`

Deletes a batch.

**Parameters:**

- `batchId` (string) - Batch ID to delete

**Returns:**

```typescript
{
  success: boolean
  error?: string
}
```

**Safety:**

- **Prevents deletion** if batch has students
- Returns error: "Cannot delete batch with assigned students"

---

### `assignStudentsToBatchAction(studentIds, batchId)`

Assigns students to a batch (bulk operation).

**Parameters:**

- `studentIds` (string[]) - Array of student IDs
- `batchId` (string | null) - Target batch ID (null = unassign)

**Returns:**

```typescript
{
  success: boolean
  error?: string
  updated?: number
}
```

**Database Operations:**

- Updates all students in single transaction
- Revalidates both source and target batches
- Updates student counts

**Example:**

```typescript
// Assign to batch
await assignStudentsToBatchAction(['s1', 's2'], 'batch-123')

// Unassign from batch
await assignStudentsToBatchAction(['s1', 's2'], null)
```

---

## Duplicate Management Actions

### `mergeDuplicatesAction(keepId, deleteIds, mergeData)`

Merges duplicate student records.

**Parameters:**

- `keepId` (string) - Student to keep
- `deleteIds` (string[]) - Students to delete
- `mergeData` (boolean) - Whether to fill nulls in keep record

**Returns:**

```typescript
{
  success: boolean
  error?: string
}
```

**Logic:**

1. If `mergeData = true`:
   - Copies non-null fields from deleted records to keep record
   - Updates keep record with merged data
2. Deletes duplicate records
3. Revalidates affected batches

**Example:**

```typescript
await mergeDuplicatesAction(
  'student-keep',
  ['student-dup1', 'student-dup2'],
  true // Merge data
)
```

---

## Query Functions

Located in `lib/db/queries/student.ts` and `lib/db/queries/batch.ts`

### `getStudentsWithBatchFiltered(filters)`

Server-side filtered student query with pagination.

**Parameters:**

```typescript
{
  search?: string
  batchIds: string[]
  statuses: StudentStatus[]
  subscriptionStatuses: SubscriptionStatus[]
  educationLevels: EducationLevel[]
  gradeLevels: GradeLevel[]
  page: number
  limit: number
}
```

**Returns:**

```typescript
{
  students: BatchStudentData[]
  totalCount: number
  page: number
  totalPages: number
}
```

**Performance:**

- Uses database indexes
- Applies filters at SQL level (not client-side)
- Limits: 1-100 students per page

---

### `getBatches()`

Gets all batches with student counts.

**Returns:**

```typescript
BatchWithCount[] // { id, name, studentCount, ... }
```

**Note:**

- Student count excludes withdrawn students
- Called by both @batches and @students slots
- Consider React `cache()` for deduplication

---

### `findDuplicateStudents()`

Finds students with matching phone numbers.

**Algorithm:**

- Normalizes phone (removes non-digits)
- Requires minimum 7 digits
- Groups by exact phone match
- Returns groups with 2+ students

**Returns:**

```typescript
{
  phone: string
  normalizedPhone: string
  students: Student[]
}[]
```

---

## URL Parameters (Read-Only State)

Managed by `hooks/use-url-filters.ts`

### Search Params Structure

```typescript
/admin/mahad/cohorts?search=ahmed&batch=batch-1&status=enrolled&page=2&limit=50
```

**Parameters:**

- `search` (string) - Search query (name, email, phone)
- `batch` (string[]) - Batch IDs to filter
- `status` (string[]) - Student statuses
- `subscriptionStatus` (string[]) - Subscription statuses
- `educationLevel` (string[]) - Education levels
- `gradeLevel` (string[]) - Grade levels
- `page` (number) - Current page (1-indexed)
- `limit` (number) - Items per page (1-100)

**Parsing:**

- Handled by `lib/parse-search-params.ts`
- Validates enums against Prisma types
- Caps array sizes to prevent URL abuse
- Returns type-safe `ParsedCohortSearchParams`

---

## Error Handling

### Action Error Format

All actions return consistent structure:

```typescript
type ActionResult = {
  success: boolean
  error?: string
  data?: any
}
```

### Common Error Codes

**Prisma Errors:**

- `P2002`: Unique constraint violation (email/phone duplicate)
- `P2025`: Record not found
- `P2003`: Foreign key constraint (can't delete with relations)

**Custom Errors:**

- "Cannot delete batch with assigned students"
- "Student not found"
- "Invalid filter parameters"

---

## State Management

### Zustand Store (`store/ui-store.ts`)

**State:**

```typescript
{
  selectedStudentIds: Set<string>
  selectedBatchId: string | null
  openDialog: 'createBatch' | 'assignStudents' | 'duplicates' | null
}
```

**Actions:**

- `toggleStudent(id)` - Toggle student selection
- `setSelected(ids[])` - Bulk select
- `clearSelected()` - Clear selection
- `selectBatch(id)` - Select batch
- `setDialogOpen(dialog)` - Open dialog
- `reset()` - Reset all state

**Note:** Filters are NOT in Zustand - they're in URL params via `useURLFilters()`.

---

## Performance Considerations

### Database Indexes

```sql
CREATE INDEX "Student_email_idx" ON "Student"("email");
CREATE INDEX "Student_name_idx" ON "Student"("name");
CREATE INDEX "Student_batchId_idx" ON "Student"("batchId");
CREATE INDEX "Student_subscriptionStatus_idx" ON "Student"("subscriptionStatus");
CREATE INDEX "Student_educationLevel_idx" ON "Student"("educationLevel");
CREATE INDEX "Student_gradeLevel_idx" ON "Student"("gradeLevel");
CREATE INDEX "Student_program_idx" ON "Student"("program");
```

### Query Optimization

- **Pagination**: 50 students per page (configurable 1-100)
- **Parallel fetching**: `Promise.all([getBatches(), getStudents()])`
- **Select optimization**: Explicit field selection, no `select: true`
- **Filtering**: Applied at database level

### Known Trade-offs

1. **getBatches() Duplication**
   - Called in both @batches and @students slots
   - Intentional (parallel routes prioritize isolation)
   - ~2 DB calls per page load
   - Consider React `cache()` if performance issue

---

## Revalidation Strategy

### Cache Invalidation

```typescript
// After mutations:
revalidatePath('/admin/mahad/cohorts')
revalidatePath('/admin/mahad/cohorts/students/[id]')
```

### When to Revalidate

- After creating batch → revalidate cohorts page
- After deleting student → revalidate cohorts + batch pages
- After updating student → revalidate student detail page
- After merging duplicates → revalidate all affected routes

---

## Testing

### Test Coverage by Area

- ✅ **parseSearchParams**: 36 tests (100% coverage)
- ✅ **use-url-filters**: 12 tests (comprehensive)
- ✅ **ui-store**: 62 tests (basic + advanced)
- ✅ **student-form-utils**: Good coverage
- ⚠️ **Server actions**: 0 tests
- ⚠️ **Database queries**: 5 tests (partial)
- ⚠️ **Components**: Limited rendering tests

### Running Tests

```bash
# All mahad tests
npm test -- mahad

# Specific test files
npm test parse-search-params
npm test ui-store
npm test use-url-filters

# Watch mode
npm test -- --watch
```

---

## Common Usage Patterns

### Filtering Students

```typescript
// In a server component:
import { parseSearchParams } from '../lib/parse-search-params'
import { getStudentsWithBatchFiltered } from '@/lib/db/queries/student'

const filters = parseSearchParams(await searchParams)
const result = await getStudentsWithBatchFiltered(filters)
```

### Selecting Students

```typescript
// In a client component:
import { useUIStore } from '../store/ui-store'

const setSelected = useUIStore((s) => s.setSelected)
const selectedIds = useUIStore((s) => s.selectedStudentIds)

// Bulk select
setSelected(['student-1', 'student-2'])

// Check if selected
const isSelected = selectedIds.has('student-1')
```

### URL Filters

```typescript
// In a client component:
import { useURLFilters } from '../hooks/use-url-filters'

const { filters, setSearch, toggleBatch, resetFilters } = useURLFilters()

// Update search
setSearch('Ahmed')

// Toggle batch filter
toggleBatch('batch-123')

// Clear all filters
resetFilters()
```

---

## Security Notes

### Input Validation

- ✅ **All forms validated with Zod** schemas
- ✅ **Server-side validation** (can't be bypassed)
- ✅ **Prisma parameterized queries** (SQL injection safe)
- ✅ **Unique constraints** at database level

### Program Isolation

**Critical:** All queries MUST filter by `program: 'MAHAD_PROGRAM'`

```typescript
// CORRECT:
const student = await prisma.student.findFirst({
  where: {
    id,
    program: 'MAHAD_PROGRAM', // Always include
  },
})

// WRONG (security risk):
const student = await prisma.student.findFirst({
  where: { id }, // Missing program filter!
})
```

### Authentication

- Public routes (`/mahad/*`) are unauthenticated (intended)
- Admin routes (`/admin/mahad/*`) require authentication (handled at layout level)
- Rate limiting recommended for `/mahad/register`

---

## Constants & Configuration

### Pagination Limits (`constants/pagination.ts`)

```typescript
DEFAULT_PAGE_SIZE: 50
MAX_PAGE_SIZE: 100
MIN_PAGE_SIZE: 1
MAX_BATCH_FILTERS: 50
MAX_ENUM_FILTERS: 20
```

### Student Detail Fields (`constants/student-detail.ts`)

Defines which fields are editable inline and their display order.

---

## Future Enhancements

Based on codebase analysis:

1. **Parent Portal** - Database fields exist but no UI
2. **Grade Management** - No grade entry system yet
3. **Attendance UI** - Schema exists, no mahad-specific UI
4. **Reports** - No analytics dashboard
5. **Bulk Import** - No CSV import feature

---

**Last Updated**: 2025-11-17
**Version**: 1.0.0
