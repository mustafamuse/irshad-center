# Task 3: Teacher Service — Report

## Status

Complete. All gates green.

## Scope

`lib/services/shared/teacher-service.ts` — moved every direct Prisma model call
(literal `client.X` / `tx.X`, ~20 call sites across 10 exported functions) into
query functions under `lib/db/queries/`. No exported name, signature, return
type, where-clause, error handling, or logging changed.

## New query functions

`lib/db/queries/teacher.ts`:

- `teacherWithDetailsInclude` / `TeacherWithDetails` — moved from the service
  (same shape: `person: true`, `programs: { where: { isActive: true } }`)
- `createTeacherWithDetails(personId, client)`
- `deactivateAllTeacherPrograms(teacherId, client)`
- `findTeacherProgramEnrollment(teacherId, program, client)`
- `upsertActiveTeacherProgram(teacherId, program, client)`
- `deactivateTeacherProgram(teacherId, program, client)` (single program)
- `deactivateTeacherPrograms(teacherId, programs[], client)` (`program: { in: [...] }`)
- `getActiveTeacherPrograms(teacherId, client)`
- `getActiveTeacherProgramNames(teacherId, client)` (`select: { program: true }`)
- `findTeacherIdById(teacherId, client)` (existence check, `select: { id: true }`)
- `getTeachersByProgramWithDetails(program, client)`
- `getAllTeachersWithDetails(client)`
- `createTeacherProgramEnrollment(teacherId, program, client)`
- `deactivateTeacherDugsiProgramShifts(teacherId, client)`
- `findActiveTeacherProgramEnrollment(teacherId, program, client)`

`lib/db/queries/person.ts`:

- `findPersonByEmailOrPhone(email, phone, client)` — `findFirst` with the same
  conditional `OR` shape (`email`/`phone` each only included if non-null),
  `select: { id: true }`

## Reused (exact semantic match, no new function)

- `getTeacherById` (`lib/db/queries/teacher.ts`) — reused in
  `assignTeacherToProgram` (identical `findUnique` + `relationLoadStrategy: 'join'`
  - `include: { person: true }`)
- `createPerson` (`lib/db/queries/person.ts`) — reused in
  `createPersonTeacherAndAssignDugsi`'s tx callback (identical `create({ data: { name, email, phone } })`)
- `countActiveClassesForTeacher` (`lib/db/queries/dugsi-class.ts`) — reused in
  `bulkAssignPrograms`'s Dugsi-class-assignment guard (identical
  `dugsiClassTeacher.count({ where: { teacherId, isActive: true } })`)

## Behavior notes

- `bulkAssignPrograms`'s `executeInTransaction` callback now threads the `tx`
  client through `getActiveTeacherProgramNames`, `countActiveClassesForTeacher`,
  `deactivateTeacherPrograms`, and `upsertActiveTeacherProgram` — same
  atomicity as before, no `= prisma` default omitted (none of these queries
  are transaction-only on their own, so I kept the standard default-param
  pattern instead of the Task 2 tx-required precedent).
- `createTeacherAndAssignDugsi` and `createPersonTeacherAndAssignDugsi` both
  call `createTeacherProgramEnrollment(teacherId, 'DUGSI_PROGRAM', tx)` inside
  their transactions — same string literal passed as before (no cast needed;
  `Program` is a Prisma string-literal union).
- Removed the service-local `TeacherWithDetails` export; verified via grep
  that no other file imports it from `teacher-service.ts` (the unrelated
  `TeacherWithDetails` interface in `app/admin/dugsi/teachers/actions.ts` is a
  separate, pre-existing type).

## Tests

- Did not need to change `lib/services/shared/__tests__/teacher-service.test.ts`
  — it mocks `@/lib/db`'s `prisma` object and asserts call args against the
  `tx` stub passed into `$transaction`. Since query functions take the caller's
  `client` param and call methods on it directly, the existing mocks/assertions
  transparently cover the new query functions with no loss of fidelity.
- `bun run test lib/services/shared` — 4 files, 83 tests passed.
- `bun run test lib/db/queries` — 14 files, 151 tests passed (teacher.ts and
  person.ts additions didn't break existing query tests).
- `app/admin/dugsi/teachers/__tests__/update-teacher-details.test.ts` (the
  other consumer of teacher-service) — 8 tests passed.

## Gates

- `bunx tsc --noEmit` — clean
- `bun run lint` — zero errors (one pre-existing unrelated warning in
  `checkin-history-tab.tsx`, not touched by this task)
- `grep` on `teacher-service.ts` for `client\.` / `tx\.` outside imports —
  no matches; all Prisma access now flows through the query layer

## Concerns

None. Task 1/2 precedent (person.ts, relationships.ts) was checked first;
no cross-task duplication.
