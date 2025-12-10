# Multi-Program Teacher System

## Overview

The teacher system enables staff to be assigned as teachers across multiple programs (Mahad, Dugsi, etc.) and linked to specific students. Teachers are an extension of the Person entity, allowing existing people in the system to be promoted to teacher roles.

## Data Model

### Core Entities

```
Person (1) ←──── (1) Teacher (1) ←──── (*) TeacherProgram
                      │
                      └───────────── (*) TeacherAssignment ────→ ProgramProfile
```

### Teacher

Links a Person to teacher capabilities. A Person can only have one Teacher record.

| Field     | Type     | Description           |
| --------- | -------- | --------------------- |
| id        | UUID     | Primary key           |
| personId  | UUID     | FK to Person (unique) |
| isActive  | Boolean  | Soft delete flag      |
| createdAt | DateTime | Creation timestamp    |
| updatedAt | DateTime | Last update           |

### TeacherProgram

Junction table for teacher-program enrollment. Teachers must be enrolled in a program before they can be assigned students in that program.

| Field     | Type    | Description                        |
| --------- | ------- | ---------------------------------- |
| id        | UUID    | Primary key                        |
| teacherId | UUID    | FK to Teacher                      |
| program   | Program | MAHAD_PROGRAM, DUGSI_PROGRAM, etc. |
| isActive  | Boolean | Enrollment status                  |

**Constraints**: Unique index on `(teacherId, program)`

### TeacherAssignment

Links a teacher to a student (ProgramProfile) with optional shift tracking.

| Field            | Type    | Description                               |
| ---------------- | ------- | ----------------------------------------- |
| id               | UUID    | Primary key                               |
| teacherId        | UUID    | FK to Teacher                             |
| programProfileId | UUID    | FK to ProgramProfile (student)            |
| shift            | Shift?  | MORNING or AFTERNOON (required for Dugsi) |
| startDate        | Date    | Assignment start                          |
| endDate          | Date?   | Assignment end (null = active)            |
| notes            | String? | Optional notes                            |
| isActive         | Boolean | Soft delete flag                          |

**Constraints**: Unique index on `(teacherId, programProfileId, shift)`

## Key Concepts

### 1. Program Enrollment

Before a teacher can be assigned students in a program, they must be enrolled in that program via TeacherProgram.

```typescript
// Must exist before assigning Dugsi students
await assignTeacherToProgram(teacherId, Program.DUGSI_PROGRAM)
```

### 2. Shift Requirements

**Dugsi Program**: Shift is required (MORNING or AFTERNOON)

- Students are divided into morning and afternoon sessions
- A teacher can teach the same student in different shifts

**Mahad Program**: Shift is not used

- Pass `null` for shift parameter
- If shift is provided, it's logged as a warning but allowed

### 3. Soft Delete Pattern

Teachers and assignments are soft-deleted (set `isActive = false`) rather than hard-deleted. This preserves historical data and relationships.

### 4. Multi-Role Support

A Person can simultaneously be:

- A teacher (via Teacher table)
- A parent (via GuardianRelationship)
- A student (via ProgramProfile)
- A payer (via BillingAccount)

## Service Layer

### Core Service

**File**: `lib/services/shared/teacher-service.ts`

Key functions:

| Function                                        | Description                         |
| ----------------------------------------------- | ----------------------------------- |
| `createTeacher(personId)`                       | Promote Person to Teacher           |
| `deleteTeacher(teacherId)`                      | Soft delete teacher and assignments |
| `assignTeacherToProgram(teacherId, program)`    | Enroll in program                   |
| `removeTeacherFromProgram(teacherId, program)`  | Remove program enrollment           |
| `bulkAssignPrograms(teacherId, programs[])`     | Sync program enrollments            |
| `assignTeacherToStudent(input)`                 | Create teacher-student assignment   |
| `getTeacherStudents(teacherId, program?)`       | List assigned students              |
| `validateShiftRequirement(program, shift)`      | Validate shift for program          |
| `validateTeacherForProgram(teacherId, program)` | Check program enrollment            |

### Server Actions

**File**: `app/admin/teachers/actions.ts`

| Action                              | Description                         |
| ----------------------------------- | ----------------------------------- |
| `createTeacherAction`               | Create teacher from existing Person |
| `searchTeachersAction`              | Search teachers with filters        |
| `assignTeacherToProgramAction`      | Add program enrollment              |
| `removeTeacherFromProgramAction`    | Remove program enrollment           |
| `assignTeacherToStudentAction`      | Create student assignment           |
| `deactivateTeacherAssignmentAction` | End an assignment                   |

## Admin Workflows

### Create Teacher from Existing Person

1. Search for person in `/admin/people/lookup`
2. Navigate to teacher creation form
3. Select person by ID
4. Assign initial programs

### Enroll Teacher in Programs

1. Find teacher in `/admin/teachers`
2. Click "Manage Programs"
3. Toggle programs on/off
4. Changes sync via `bulkAssignPrograms()`

### Assign Teacher to Student (Dugsi)

1. Navigate to student in Dugsi admin
2. Select "Assign Teacher"
3. Choose teacher (must be enrolled in DUGSI_PROGRAM)
4. Select shift (MORNING or AFTERNOON)
5. Assignment created with shift tracking

## Validation Rules

### Assignment Uniqueness

The composite unique index `(teacherId, programProfileId, shift)` ensures:

- One teacher per student per shift (Dugsi)
- One teacher per student (Mahad, where shift is null)

### Program Enrollment Check

Before creating a TeacherAssignment, the service validates:

```typescript
const enrollment = await client.teacherProgram.findFirst({
  where: { teacherId, program, isActive: true },
})
if (!enrollment) throw ValidationError
```

### Shift Validation

```typescript
// Dugsi: shift required
if (program === 'DUGSI_PROGRAM' && !shift) {
  throw new ValidationError('Shift is required for Dugsi program assignments')
}

// Non-Dugsi: shift logged as warning but allowed
if (program !== 'DUGSI_PROGRAM' && shift) {
  logger.warn({ program, shift }, 'Shift provided for non-Dugsi program')
}
```

## Error Handling

### P2002 (Unique Constraint)

Race conditions are handled by catching P2002 errors:

```typescript
try {
  await client.teacherAssignment.create({ data })
} catch (error) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ValidationError('Assignment already exists for this combination')
  }
  throw error
}
```

### Common Error Codes

| Code                         | Message                                    |
| ---------------------------- | ------------------------------------------ |
| `TEACHER_NOT_FOUND`          | Teacher ID doesn't exist                   |
| `PROFILE_NOT_FOUND`          | Program profile (student) not found        |
| `TEACHER_NOT_ENROLLED`       | Teacher not enrolled in target program     |
| `SHIFT_REQUIRED`             | Dugsi assignment missing shift             |
| `DUPLICATE_ASSIGNMENT`       | Assignment already exists                  |
| `DUPLICATE_SHIFT_ASSIGNMENT` | Student already has teacher for this shift |

## Migration Notes

### Shift Enum Unification

Migration `20251206000000_unify_shift_enums`:

- Unified `Shift` and `StudentShift` enums into single `Shift`
- Converts `EVENING` → `AFTERNOON` (if any existed)
- Run `scripts/verify-shift-migration.ts` before deploying to verify data

## Related Files

| Path                                     | Purpose                                           |
| ---------------------------------------- | ------------------------------------------------- |
| `prisma/schema.prisma`                   | Teacher, TeacherProgram, TeacherAssignment models |
| `lib/services/shared/teacher-service.ts` | Core business logic                               |
| `app/admin/teachers/actions.ts`          | Server actions                                    |
| `app/admin/teachers/page.tsx`            | Admin UI                                          |
| `lib/mappers/person-mapper.ts`           | Person entity mapping                             |
| `lib/db/queries/person.ts`               | Person queries                                    |
| `scripts/verify-shift-migration.ts`      | Pre-migration data verification                   |
