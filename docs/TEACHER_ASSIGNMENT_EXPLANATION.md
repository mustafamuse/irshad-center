# TeacherAssignment Explanation

## What is TeacherAssignment?

**TeacherAssignment** is a model that **links teachers to Dugsi students** with **shift information** (morning or evening).

## Why Do We Need It?

**Dugsi (K-12) Structure:**

- ❌ **No batches** (unlike Mahad which uses cohorts/batches)
- ✅ **Assigned teachers** - Each student has a teacher
- ✅ **Shifts** - Students attend either morning or evening shift

**Example:**

- Student "Ahmed" → Assigned to "Ustadh Ali" → Morning shift
- Student "Fatima" → Assigned to "Ustadh Ali" → Evening shift
- Student "Hassan" → Assigned to "Ustadh Maryam" → Morning shift

## Schema Structure

```prisma
model TeacherAssignment {
  id               String    @id
  teacherId        String    // Which teacher
  programProfileId String    // Which Dugsi student
  shift            Shift     // MORNING or EVENING
  startDate        DateTime  // When assignment started
  endDate          DateTime? // When assignment ended (null if active)
  isActive         Boolean   // Currently active?
  notes            String?   // Optional notes

  teacher        Teacher        @relation(...)
  programProfile ProgramProfile @relation(...)

  @@unique([teacherId, programProfileId, shift])
}
```

## Key Features

### 1. One Teacher Per Student Per Shift

```typescript
// ✅ Valid - Student can have different teachers for different shifts
{
  teacherId: "teacher-1",
  programProfileId: "student-ahmed",
  shift: "MORNING"
}

{
  teacherId: "teacher-2",
  programProfileId: "student-ahmed",
  shift: "EVENING"
}
```

### 2. Assignment History

```typescript
// Track when assignments change
{
  teacherId: "teacher-1",
  programProfileId: "student-ahmed",
  shift: "MORNING",
  startDate: "2024-01-01",
  endDate: "2024-06-30",  // Assignment ended
  isActive: false
}

{
  teacherId: "teacher-2",
  programProfileId: "student-ahmed",
  shift: "MORNING",
  startDate: "2024-07-01",
  endDate: null,  // Currently active
  isActive: true
}
```

### 3. Multiple Students Per Teacher

```typescript
// One teacher can have many students
Teacher "Ustadh Ali":
  - Student Ahmed (MORNING)
  - Student Fatima (EVENING)
  - Student Hassan (MORNING)
  - Student Aisha (EVENING)
```

## Real-World Example

**Scenario**: Dugsi school with morning and evening shifts

**Morning Shift Students:**

- Ahmed → Ustadh Ali (Morning)
- Hassan → Ustadh Ali (Morning)
- Aisha → Ustadh Maryam (Morning)

**Evening Shift Students:**

- Fatima → Ustadh Ali (Evening)
- Omar → Ustadh Maryam (Evening)

**Database Records:**

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

## How It's Different from Mahad

### Mahad (College):

- Uses **batches** (cohorts)
- Students grouped by batch
- No teacher assignments (for now)

### Dugsi (K-12):

- Uses **teacher assignments**
- Students assigned to teachers
- Has **shifts** (morning/evening)
- No batches

## Usage Examples

### Assign a Teacher to a Student

```typescript
// Assign Ustadh Ali to Ahmed for morning shift
await prisma.teacherAssignment.create({
  data: {
    teacherId: 'ali-id',
    programProfileId: 'ahmed-profile-id', // Must be DUGSI_PROGRAM
    shift: 'MORNING',
    isActive: true,
  },
})
```

### Find All Students for a Teacher

```typescript
// Get all morning shift students for Ustadh Ali
const assignments = await prisma.teacherAssignment.findMany({
  where: {
    teacherId: 'ali-id',
    shift: 'MORNING',
    isActive: true,
  },
  include: {
    programProfile: {
      include: {
        person: true, // Student name, etc.
      },
    },
  },
})
```

### Find Teacher for a Student

```typescript
// Get teacher assignments for Ahmed
const assignments = await prisma.teacherAssignment.findMany({
  where: {
    programProfileId: 'ahmed-profile-id',
    isActive: true,
  },
  include: {
    teacher: true, // Teacher name, email, etc.
  },
})
```

### Change Teacher Assignment

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

## Summary

**TeacherAssignment** = The link between teachers and Dugsi students with shift information

**Key Points**:

- ✅ Links teachers to Dugsi students
- ✅ Includes shift (morning/evening)
- ✅ Tracks assignment history
- ✅ Supports active/inactive assignments
- ✅ One teacher per student per shift (unique constraint)

**Dugsi Structure**:

- Students → Assigned to Teachers → With Shifts
- No batches (unlike Mahad)
