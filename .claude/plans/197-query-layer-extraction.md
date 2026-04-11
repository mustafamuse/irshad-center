# Plan: Issue #197 — Extract Direct Prisma Calls to Query Layer

## Scope

8 changes (2 drop-ins, 6 new functions) across 11 files.

### What we are NOT doing

- Lines 914 (`searchPeopleAction`) and 167 (`lookupPersonAction`) — complex one-off queries with one caller, left inline
- `lib/actions/` files (get-batch-data.ts, get-students.ts, backup-data.ts) — specialized, no reuse potential

---

## Change Table

| #   | Type             | Function                       | Query file       | Replaces                                                        |
| --- | ---------------- | ------------------------------ | ---------------- | --------------------------------------------------------------- |
| A1  | Drop-in (exists) | `getTeacherById`               | `teacher.ts`     | line 515 `teachers/actions.ts`                                  |
| A2  | New fn           | `getBatchDropdownOptions`      | `batch.ts`       | line 13 `payments/actions.ts`                                   |
| B1  | New fn           | `getClassCountsByTeacherIds`   | `dugsi-class.ts` | lines 191, 252 `teachers/actions.ts`                            |
| B2  | New fn           | `getActiveClassesForTeacher`   | `dugsi-class.ts` | line 673 `teachers/actions.ts`                                  |
| B3  | New fn           | `countActiveClassesForTeacher` | `dugsi-class.ts` | lines 786 `teachers/actions.ts`, 280 `people/lookup/actions.ts` |
| B4  | New fn           | `getTeacherDugsiProgram`       | `teacher.ts`     | lines 599, 642 `teachers/actions.ts`                            |
| B5  | New fn           | `updateTeacherProgramShifts`   | `teacher.ts`     | line 611 `teachers/actions.ts`                                  |
| B6  | New fn           | `updatePersonContact`          | `person.ts`      | line 535 `teachers/actions.ts`                                  |

---

## Function Specs

### A1 — drop-in, no new code

`getTeacherById(teacherId, client?)` already exists in `teacher.ts`.
Returns `TeacherWithPerson | null` with `relationLoadStrategy: 'join'`.

**Wire-up** (`teachers/actions.ts` line 515):

```typescript
// Before
const teacher = await prisma.teacher.findUnique({
  where: { id: teacherId },
  include: { person: true },
})
// After
const teacher = await getTeacherById(teacherId)
```

Add `getTeacherById` to the import from `@/lib/db/queries/teacher`.
No test needed — already tested.

---

### A2 — `getBatchDropdownOptions`

**File:** `lib/db/queries/batch.ts`

```typescript
export async function getBatchDropdownOptions(
  client: DatabaseClient = prisma
): Promise<{ id: string; name: string }[]> {
  return client.batch.findMany({
    select: { id: true, name: true },
    where: { name: { not: 'Test' } },
    orderBy: { name: 'asc' },
  })
}
```

Why not `getBatches()`: that returns `BatchWithCount[]` with enrollment counts, ordered by startDate desc — different shape and purpose.
"Test" filter is hardcoded — it's a data convention, not business logic.

**Wire-up** (`mahad/payments/actions.ts` line 13):

- Replace `prisma.batch.findMany(...)` with `getBatchesForFilter()`
- Remove `import { prisma } from '@/lib/db'` — no other direct prisma calls remain

**Tests** (add to `lib/db/queries/__tests__/batch.test.ts`):

- assert called with `select: { id: true, name: true }`
- assert called with `where: { name: { not: 'Test' } }`
- assert called with `orderBy: { name: 'asc' }`
- mock returns `[]` → returns `[]`

---

### B1 — `getClassCountsByTeacherIds`

**File:** `lib/db/queries/dugsi-class.ts`

```typescript
export async function getClassCountsByTeacherIds(
  teacherIds: string[],
  client: DatabaseClient = prisma
): Promise<Map<string, number>> {
  const rows = await client.dugsiClassTeacher.groupBy({
    by: ['teacherId'],
    where: { teacherId: { in: teacherIds }, isActive: true },
    _count: { id: true },
  })
  return new Map(rows.map((r) => [r.teacherId, r._count.id]))
}
```

Note: `groupBy` does NOT use `relationLoadStrategy: 'join'` — it's a pure aggregate.
Returns `Map<string, number>` — callers do `map.get(id) ?? 0`.

**Edge cases:**

- Empty `teacherIds`: `{ in: [] }` returns `[]` → empty Map → `.get(id) ?? 0 === 0`. Correct.
- Teacher with 0 active classes: Not in groupBy results → `?? 0` fallback. Correct.

**Wire-up** (`teachers/actions.ts` lines 191–202 and 252–263):

```typescript
// Before (both sites)
const classCounts = await prisma.dugsiClassTeacher.groupBy({...})
const classCountMap = new Map<string, number>(classCounts.map((cc) => [cc.teacherId, cc._count.id]))
// After
const classCountMap = await getClassCountsByTeacherIds(teacherIds)
```

**Tests** (add to `lib/db/queries/__tests__/dugsi-class.test.ts`):

New mock: `mockDugsiClassTeacherGroupBy: vi.fn()`
Add to prisma mock: `dugsiClassTeacher: { groupBy: mockDugsiClassTeacherGroupBy }`

- assert `by: ['teacherId']`
- assert `where: { isActive: true }`
- assert `where: { teacherId: { in: ['t1', 't2'] } }`
- mock returns `[{ teacherId: 't1', _count: { id: 3 } }]` → `result.get('t1') === 3`
- mock returns `[]` → `result.size === 0`

---

### B2 — `getActiveClassesForTeacher`

**File:** `lib/db/queries/dugsi-class.ts`

```typescript
export async function getActiveClassesForTeacher(
  teacherId: string,
  client: DatabaseClient = prisma
) {
  return client.dugsiClassTeacher.findMany({
    where: { teacherId, isActive: true },
    relationLoadStrategy: 'join',
    include: {
      class: { select: { name: true, shift: true } },
    },
  })
}
```

Return type: let TypeScript infer the Prisma payload.

**Edge cases:**

- No active classes: returns `[]` → `deactivateTeacherAction` proceeds. Correct.
- Caller formats error: `c.class.name` and `c.class.shift` — shape preserved exactly.

**Wire-up** (`teachers/actions.ts` line 673):

```typescript
const activeClasses = await getActiveClassesForTeacher(teacherId)
```

**Tests** (add to `dugsi-class.test.ts`):

New mock: `mockDugsiClassTeacherFindMany: vi.fn()`

- assert `relationLoadStrategy: 'join'`
- assert `where: { teacherId: 't1', isActive: true }`
- assert `include: { class: { select: { name: true, shift: true } } }`

---

### B3 — `countActiveClassesForTeacher`

**File:** `lib/db/queries/dugsi-class.ts`

```typescript
export async function countActiveClassesForTeacher(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<number> {
  return client.dugsiClassTeacher.count({
    where: { teacherId, isActive: true },
  })
}
```

Highest-value extraction — eliminates duplication across two files.

**Wire-up:**

- `teachers/actions.ts` line 786: `const activeClasses = await countActiveClassesForTeacher(input.teacherId)`
- `people/lookup/actions.ts` line 280: `const classCount = await countActiveClassesForTeacher(person.teacher.id)`

**Tests** (add to `dugsi-class.test.ts`):

New mock: `mockDugsiClassTeacherCount: vi.fn()`

- assert `where: { teacherId: 't1', isActive: true }`
- mock returns `0` → result `=== 0`

---

### B4 — `getTeacherDugsiProgram`

**File:** `lib/db/queries/teacher.ts`

```typescript
export async function getTeacherDugsiProgram(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<TeacherProgram | null> {
  return client.teacherProgram.findFirst({
    where: { teacherId, program: 'DUGSI_PROGRAM', isActive: true },
  })
}
```

Import `TeacherProgram` from `@prisma/client`.
`@@unique([teacherId, program])` means at most one active Dugsi record per teacher — `findFirst` is safe.

**Edge cases:**

- Teacher not enrolled in Dugsi: returns `null` → action returns `'Teacher is not enrolled in Dugsi'`. Correct.
- Teacher enrolled but `isActive: false`: returns `null` — same handling. Correct.

**Wire-up:**

- Line 599: `const teacherProgram = await getTeacherDugsiProgram(teacherId)` — use `teacherProgram.id` for update
- Line 642: `const teacherProgram = await getTeacherDugsiProgram(teacherId)` — read `teacherProgram?.shifts ?? []`

**Tests** (add to `lib/db/queries/__tests__/teacher.test.ts`):

New mock: `mockTeacherProgramFindFirst: vi.fn()`
Add to prisma mock: `teacherProgram: { findFirst: mockTeacherProgramFindFirst }`

- assert `where: { teacherId: 't1', program: 'DUGSI_PROGRAM', isActive: true }`
- mock returns `null` → result `=== null`
- mock returns record → returns it unchanged

---

### B5 — `updateTeacherProgramShifts`

**File:** `lib/db/queries/teacher.ts`

```typescript
export async function updateTeacherProgramShifts(
  teacherProgramId: string,
  shifts: Shift[],
  client: DatabaseClient = prisma
): Promise<void> {
  await client.teacherProgram.update({
    where: { id: teacherProgramId },
    data: { shifts },
  })
}
```

Import `Shift` from `@prisma/client`.
Returns `void` — action returns `shifts` from validated input, not Prisma response.

**Edge cases:**

- P2025 (record not found): Propagates — caught by action's generic catch. Only happens in a race condition (record deleted between the `getTeacherDugsiProgram` read and this write).
- `shifts: []`: Valid — clears assignments. `Shift[]` accepts empty array.

**Wire-up** (`teachers/actions.ts` line 611):

```typescript
await updateTeacherProgramShifts(teacherProgram.id, shifts)
```

**Tests** (add to `teacher.test.ts`):

New mock: `mockTeacherProgramUpdate: vi.fn()`
Add to prisma mock: `teacherProgram: { ..., update: mockTeacherProgramUpdate }`

- assert `where: { id: 'tp-1' }`
- assert `data: { shifts: ['MORNING'] }`
- call with `[]` → assert `data: { shifts: [] }` (empty valid)

---

### B6 — `updatePersonContact`

**File:** `lib/db/queries/person.ts`

```typescript
export async function updatePersonContact(
  personId: string,
  data: Prisma.PersonUpdateInput,
  client: DatabaseClient = prisma
): Promise<void> {
  await client.person.update({
    where: { id: personId },
    data,
  })
}
```

Import `Prisma` from `@prisma/client`.

**Edge cases:**

- Normalization happens in the action BEFORE this call — do NOT normalize here.
- P2002 (duplicate email/phone): propagates — action already has dedicated P2002 catch.
- P2025 (personId not found): propagates — action generic catch.
- `data` with only `{ name }`: Valid — Prisma accepts partial updates.

**Wire-up** (`teachers/actions.ts` line 535):

```typescript
await updatePersonContact(teacher.personId, personData)
```

**Tests** (new file `lib/db/queries/__tests__/person.test.ts`):

```typescript
const { mockPersonUpdate } = vi.hoisted(() => ({
  mockPersonUpdate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { person: { update: mockPersonUpdate } },
}))
```

- assert `where: { id: 'p-1' }`
- assert data passed through unchanged: `{ name: 'Alice' }` → `data: { name: 'Alice' }`
- assert with null contact: `{ name: 'Alice', email: null }` → passed through

---

## Import Changes Per Action File

### `app/admin/dugsi/teachers/actions.ts`

- Extend `@/lib/db/queries/teacher` import: add `getTeacherById`, `getTeacherDugsiProgram`, `updateTeacherProgramShifts`
- Add: `import { getClassCountsByTeacherIds, getActiveClassesForTeacher, countActiveClassesForTeacher } from '@/lib/db/queries/dugsi-class'`
- Add: `import { updatePersonContact } from '@/lib/db/queries/person'`
- KEEP `import { prisma }` — still needed for `$transaction` at line 697
- KEEP `import { Prisma }` — still needed for `Prisma.PersonUpdateInput` and P2002 catch

### `app/admin/people/lookup/actions.ts`

- Add: `import { countActiveClassesForTeacher } from '@/lib/db/queries/dugsi-class'`
- KEEP `import { prisma }` — still needed for complex `person.findFirst` (line 167) and `$transaction` in `deletePersonAction`

### `app/admin/mahad/payments/actions.ts`

- Add: `import { getBatchDropdownOptions } from '@/lib/db/queries/batch'`
- REMOVE: `import { prisma } from '@/lib/db'` — no other direct prisma calls remain

---

## Build Order (TDD)

```
Step 1 — A1: swap getTeacherById (no test, drop-in)
  → teachers/actions.ts line 515

Step 2 — A2: getBatchDropdownOptions
  RED:   batch.test.ts — failing test
  GREEN: batch.ts — implement
  WIRE:  payments/actions.ts — swap + remove prisma import
  CHECK: bun run test lib/db/queries/__tests__/batch.test.ts

Step 3 — B1/B2/B3: dugsi-class.ts (3 functions)
  RED:   dugsi-class.test.ts — 3 new test blocks, new mocks for groupBy/findMany/count
  GREEN: dugsi-class.ts — implement 3 functions
  WIRE:  teachers/actions.ts lines 191, 252, 673, 786
         people/lookup/actions.ts line 280
  CHECK: bun run test lib/db/queries/__tests__/dugsi-class.test.ts

Step 4 — B4/B5: teacher.ts (2 functions)
  RED:   teacher.test.ts — 2 new test blocks, new mocks for teacherProgram.findFirst/update
  GREEN: teacher.ts — implement 2 functions
  WIRE:  teachers/actions.ts lines 599, 611, 642
  CHECK: bun run test lib/db/queries/__tests__/teacher.test.ts

Step 5 — B6: person.ts (1 function)
  RED:   person.test.ts — new file, mock person.update
  GREEN: person.ts — implement updatePersonContact
  WIRE:  teachers/actions.ts line 535
  CHECK: bun run test lib/db/queries/__tests__/person.test.ts

Step 6 — Full verification
  bun run test lib/db/queries/__tests__/
  bun run test app/admin/dugsi/teachers/__tests__/
  npx tsc --noEmit
```
