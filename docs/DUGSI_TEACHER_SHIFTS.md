# Dugsi Teacher Assignments & Shifts

## Overview

Dugsi (K-12 program) uses **teacher assignments** with **shifts** instead of batches.

**Key Differences from Mahad:**

- ❌ **No batches** (Mahad uses batches/cohorts)
- ✅ **Assigned teachers** (each student has a teacher)
- ✅ **Shifts** (morning or evening)

---

## Schema Design

### Teacher Model

```prisma
model Teacher {
  id            String @id @default(uuid())
  personId      String @unique // Linked to Person (one Teacher per Person)
  assignments   TeacherAssignment[] // Assignments to Dugsi students
  person        Person @relation(...)
}
```

**Key Points**:

- ✅ **Linked to `Person`** - Teacher is a role, not a separate identity
- ✅ **One Teacher per Person** (unique `personId`)
- ✅ **Contact info via `Person.contactPoints`** - No email/phone on Teacher
- ✅ **Can have multiple roles** - Teacher can also be parent, payer, student

**Usage**: Teachers can be assigned to multiple Dugsi students across different shifts. A teacher can also be a parent, payer, or student themselves (all through the same `Person` record).

### TeacherAssignment Model

```prisma
model TeacherAssignment {
  id               String @id @default(uuid())
  teacherId        String
  programProfileId String  // References Dugsi ProgramProfile
  shift            Shift   // MORNING or EVENING
  startDate        DateTime @default(now())
  endDate          DateTime? // Null if currently active
  isActive         Boolean @default(true)
  notes            String?

  teacher       Teacher @relation(...)
  programProfile ProgramProfile @relation(...)

  @@unique([teacherId, programProfileId, shift])
}
```

**Key Features**:

- One teacher per student per shift (unique constraint)
- Tracks assignment history (startDate/endDate)
- Supports active/inactive assignments
- Can have notes

### Shift Enum

```prisma
enum Shift {
  MORNING
  EVENING
}
```

---

## Usage Examples

### Assigning a Teacher to a Dugsi Student

```typescript
// Assign teacher to Dugsi student for morning shift
await prisma.teacherAssignment.create({
  data: {
    teacherId: teacher.id,
    programProfileId: dugsiProfile.id, // Must be DUGSI_PROGRAM
    shift: 'MORNING',
    isActive: true,
  },
})
```

### Finding Students by Teacher and Shift

```typescript
// Get all morning shift students for a teacher
const assignments = await prisma.teacherAssignment.findMany({
  where: {
    teacherId: teacher.id,
    shift: 'MORNING',
    isActive: true,
  },
  include: {
    programProfile: {
      include: {
        person: true,
      },
    },
  },
})
```

### Finding Teacher for a Student

```typescript
// Get teacher assignments for a Dugsi student
const assignments = await prisma.teacherAssignment.findMany({
  where: {
    programProfileId: dugsiProfile.id,
    isActive: true,
  },
  include: {
    teacher: true,
  },
})
```

### Changing Teacher Assignment

```typescript
// End current assignment
await prisma.teacherAssignment.update({
  where: { id: 'assignment-id' },
  data: {
    endDate: new Date(),
    isActive: false,
  },
})

// Create new assignment
await prisma.teacherAssignment.create({
  data: {
    teacherId: 'new-teacher-id',
    programProfileId: 'student-profile-id',
    shift: 'MORNING',
    isActive: true,
  },
})
```

---

## Real-World Example

**Scenario**: Dugsi school with morning and evening shifts

**Morning Shift:**

- Ahmed → Ustadh Ali (Morning)
- Hassan → Ustadh Ali (Morning)
- Aisha → Ustadh Maryam (Morning)

**Evening Shift:**

- Fatima → Ustadh Ali (Evening)
- Omar → Ustadh Maryam (Evening)

**Database Records**:

```typescript
;[
  {
    teacherId: 'ali',
    programProfileId: 'ahmed',
    shift: 'MORNING',
    isActive: true,
  },
  {
    teacherId: 'ali',
    programProfileId: 'hassan',
    shift: 'MORNING',
    isActive: true,
  },
  {
    teacherId: 'ali',
    programProfileId: 'fatima',
    shift: 'EVENING',
    isActive: true,
  },
  {
    teacherId: 'maryam',
    programProfileId: 'aisha',
    shift: 'MORNING',
    isActive: true,
  },
  {
    teacherId: 'maryam',
    programProfileId: 'omar',
    shift: 'EVENING',
    isActive: true,
  },
]
```

**Key Insights**:

- One teacher can have students in both morning and evening shifts
- Different students in the same shift can have different teachers
- Assignments track history with startDate/endDate for reassignments

---

## Validation Rules

### Application-Level Validations Required

1. **Program Validation**:

   ```typescript
   // TeacherAssignment can only be created for Dugsi profiles
   if (programProfile.program !== 'DUGSI_PROGRAM') {
     throw new Error('Teacher assignments are only for Dugsi program')
   }
   ```

2. **Shift Validation**:

   ```typescript
   // Ensure shift is valid enum value
   if (!['MORNING', 'EVENING'].includes(shift)) {
     throw new Error('Shift must be MORNING or EVENING')
   }
   ```

3. **Active Assignment Check**:

   ```typescript
   // Check if student already has active assignment for this shift
   const existing = await prisma.teacherAssignment.findFirst({
     where: {
       programProfileId: profileId,
       shift: shift,
       isActive: true,
     },
   })

   if (existing) {
     throw new Error(`Student already has active ${shift} shift assignment`)
   }
   ```

---

## Migration from Old System

If there was a previous teacher assignment system:

1. **Create Teachers**: Migrate existing teacher data to `Teacher` model
2. **Create Assignments**: Create `TeacherAssignment` records for existing Dugsi students
3. **Set Shifts**: Determine morning/evening based on existing data or default to MORNING

---

## Future Considerations

### If Mahad Needs Teachers

If Mahad later needs teacher assignments:

- Could extend `TeacherAssignment` to support Mahad
- Or create separate `MahadTeacherAssignment` model
- Or add `program` field to `TeacherAssignment` and validate

### If More Shifts Needed

If additional shifts are needed (e.g., "AFTERNOON"):

- Add to `Shift` enum: `AFTERNOON`
- Update validation logic
- Migrate existing data if needed

---

## Related Models

- **ProgramProfile**: Dugsi profiles can have teacher assignments
- **Enrollment**: Dugsi enrollments don't have batchId (null)
- **Batch**: Mahad-only, not used by Dugsi

---

## Summary

**Dugsi Structure**:

- ✅ **Teachers** assigned to students
- ✅ **Shifts** (morning/evening)
- ❌ **No batches**
- ❌ **No class schedules** (removed)

**Mahad Structure**:

- ✅ **Batches** (cohorts)
- ❌ **No teacher assignments** (for now)
- ❌ **No class schedules** (removed)

Each program has its own structure optimized for its needs.
