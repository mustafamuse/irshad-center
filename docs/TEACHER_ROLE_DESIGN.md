# Teacher Role Design - Person-Based Identity

## Overview

**Teachers are now linked to `Person`**, not separate identities. This allows a single human to be:

- ✅ **Teacher** (staff member)
- ✅ **Parent/Guardian** (has children in programs)
- ✅ **Payer** (pays for their children or others)
- ✅ **Student** (enrolled in programs themselves)

All through **one `Person` record** with multiple role relationships.

---

## Schema Design

### Teacher Model

```prisma
model Teacher {
  id        String   @id @default(uuid())
  personId  String   @unique // One Teacher per Person
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  person      Person             @relation(...)
  assignments TeacherAssignment[] // Assignments to students
}
```

**Key Points**:

- ✅ **One `Teacher` per `Person`** (unique `personId`)
- ✅ **No email/phone on Teacher** - Use `Person.contactPoints` instead
- ✅ **Teacher is a role**, not a separate identity

### Person Model (Updated)

```prisma
model Person {
  // ... identity fields ...

  // Relations - Person can have multiple roles
  teacher                Teacher?              // Optional: Staff role
  programProfiles        ProgramProfile[]      // Student roles
  guardianRelationships  GuardianRelationship[] // Parent/Guardian roles
  billingAccounts        BillingAccount[]      // Payer roles
  contactPoints          ContactPoint[]        // Contact info
}
```

---

## Common Scenarios

### Scenario 1: Teacher Who is Also a Parent

**Example**: Ustadh Ali teaches Dugsi students AND has his own children enrolled.

**Database Structure**:

```typescript
Person {
  id: "person-ali",
  name: "Ali Hassan",
  // ... other fields ...

  // Role 1: Teacher
  teacher: {
    id: "teacher-ali",
    personId: "person-ali",
    assignments: [
      { programProfileId: "student-ahmed", shift: "MORNING" },
      { programProfileId: "student-fatima", shift: "EVENING" },
    ]
  },

  // Role 2: Parent
  guardianRelationships: [
    { dependentId: "person-ali-son", role: "PARENT" },
    { dependentId: "person-ali-daughter", role: "PARENT" },
  ],

  // Role 3: Payer (pays for his children)
  billingAccounts: [
    { id: "billing-ali", subscriptions: [...] }
  ],

  // Contact info
  contactPoints: [
    { type: "EMAIL", value: "ali@example.com", isPrimary: true },
    { type: "PHONE", value: "+1234567890", isPrimary: true },
  ]
}
```

**Query Example**:

```typescript
// Get Ustadh Ali with all roles
const ali = await prisma.person.findUnique({
  where: { id: 'person-ali' },
  include: {
    teacher: {
      include: { assignments: true },
    },
    guardianRelationships: true,
    billingAccounts: true,
    contactPoints: true,
  },
})

// Check roles
const roles = await getPersonRoles('person-ali')
// Returns: {
//   isTeacher: true,
//   isStudent: false,
//   isGuardian: true,
//   isPayer: true,
//   ...
// }
```

---

### Scenario 2: Teacher Who is Also a Student

**Example**: Ustadh Maryam teaches Dugsi AND is enrolled in Mahad program.

**Database Structure**:

```typescript
Person {
  id: "person-maryam",
  name: "Maryam Ahmed",

  // Role 1: Teacher
  teacher: {
    id: "teacher-maryam",
    assignments: [
      { programProfileId: "student-hassan", shift: "MORNING" },
    ]
  },

  // Role 2: Student (in Mahad)
  programProfiles: [
    {
      id: "profile-maryam-mahad",
      program: "MAHAD_PROGRAM",
      enrollments: [...]
    }
  ],

  // Contact info
  contactPoints: [...]
}
```

**Query Example**:

```typescript
// Get Maryam's teacher assignments
const teacherAssignments = await getTeacherAssignments('teacher-maryam')

// Get Maryam's student enrollments
const studentProfile = await prisma.programProfile.findFirst({
  where: {
    personId: 'person-maryam',
    program: 'MAHAD_PROGRAM',
  },
  include: { enrollments: true },
})
```

---

### Scenario 3: Teacher Who Pays for Students

**Example**: Ustadh Omar teaches Dugsi AND sponsors/pays for multiple students.

**Database Structure**:

```typescript
Person {
  id: "person-omar",
  name: "Omar Ibrahim",

  // Role 1: Teacher
  teacher: {
    id: "teacher-omar",
    assignments: [...]
  },

  // Role 2: Payer/Sponsor
  billingAccounts: [
    {
      id: "billing-omar",
      subscriptions: [
        {
          assignments: [
            { programProfileId: "student-sponsored-1" },
            { programProfileId: "student-sponsored-2" },
          ]
        }
      ]
    }
  ],

  // Role 3: Guardian (if sponsoring includes guardianship)
  guardianRelationships: [
    { dependentId: "student-sponsored-1", role: "SPONSOR" },
  ]
}
```

---

### Scenario 4: Teacher Who is Parent, Student, AND Payer

**Example**: Ustadh Fatima teaches Dugsi, has children in Dugsi, is enrolled in Mahad, AND pays for everything.

**Database Structure**:

```typescript
Person {
  id: "person-fatima",
  name: "Fatima Ali",

  // Role 1: Teacher
  teacher: {
    assignments: [
      { programProfileId: "student-taught-1", shift: "MORNING" },
    ]
  },

  // Role 2: Student (Mahad)
  programProfiles: [
    { program: "MAHAD_PROGRAM", enrollments: [...] }
  ],

  // Role 3: Parent
  guardianRelationships: [
    { dependentId: "person-child-1", role: "PARENT" },
    { dependentId: "person-child-2", role: "PARENT" },
  ],

  // Role 4: Payer
  billingAccounts: [
    {
      subscriptions: [
        // Pays for her Mahad enrollment
        { assignments: [{ programProfileId: "profile-fatima-mahad" }] },
        // Pays for her children's Dugsi enrollment
        { assignments: [
          { programProfileId: "profile-child-1-dugsi" },
          { programProfileId: "profile-child-2-dugsi" },
        ]}
      ]
    }
  ]
}
```

**Query Example**:

```typescript
// Get all roles for Fatima
const roles = await getPersonRoles('person-fatima')
// Returns: {
//   isTeacher: true,
//   isStudent: true,
//   studentPrograms: ["MAHAD_PROGRAM"],
//   isGuardian: true,
//   guardianRoles: ["PARENT"],
//   isPayer: true,
// }
```

---

## Identity & Role Mapping

### How Roles Work Together

**One `Person` = One Human Being**

**Multiple Role Models**:

- `Teacher` → Staff role (optional)
- `ProgramProfile` → Student role (can have multiple - one per program)
- `GuardianRelationship` → Parent/Guardian role (can have multiple - one per child)
- `BillingAccount` → Payer role (can have multiple - one per Stripe account)

**All Linked to Same `Person`**:

```typescript
Person {
  id: "person-123",
  name: "John Doe",

  // Can have ALL of these simultaneously:
  teacher: Teacher?                    // Optional staff role
  programProfiles: ProgramProfile[]   // Student in programs
  guardianRelationships: [...]        // Parent of children
  billingAccounts: [...]              // Payer for subscriptions
  contactPoints: [...]                // Contact info
}
```

---

## Benefits of This Design

### Single Source of Truth

- One `Person` record = one human
- No duplicate identities across roles
- Contact info managed in one place (`ContactPoint`)

### Flexible Role Assignment

- Person can have multiple roles simultaneously
- Roles can be added/removed independently
- No schema changes needed for new role combinations

### Query Efficiency

- Get all roles for a person in one query
- Check if person is teacher/student/parent/payer easily
- Cross-role queries (e.g., "teachers who are also parents")

### Data Consistency

- Email/phone changes update once (`ContactPoint`)
- Name changes update once (`Person`)
- No sync issues between separate teacher/student/parent tables

---

## Validation Rules

### Application-Level Validations Required

1. **TeacherAssignment Only for Dugsi**:

   ```typescript
   // When creating TeacherAssignment
   const profile = await prisma.programProfile.findUnique({
     where: { id: programProfileId },
   })

   if (profile?.program !== 'DUGSI_PROGRAM') {
     throw new Error('Teacher assignments are only for Dugsi program')
   }
   ```

2. **One Teacher Per Person**:

   ```typescript
   // When creating Teacher
   const existing = await prisma.teacher.findUnique({
     where: { personId },
   })

   if (existing) {
     throw new Error('Person is already a teacher')
   }
   ```

3. **One Active Assignment Per Student/Shift**:

   ```typescript
   // When creating TeacherAssignment
   const existing = await prisma.teacherAssignment.findFirst({
     where: {
       programProfileId,
       shift,
       isActive: true,
     },
   })

   if (existing) {
     throw new Error(`Student already has active ${shift} shift assignment`)
   }
   ```

---

## Migration Considerations

### Existing Teachers

If you have existing `Teacher` records with `email`/`phone`:

1. **Create `Person` records** for each teacher
2. **Create `ContactPoint` records** from teacher email/phone
3. **Link `Teacher` to `Person`** via `personId`
4. **Remove `email`/`phone`** from `Teacher` model

### Backfilling personId

```typescript
// Migration script example
const teachers = await prisma.teacher.findMany({
  where: { personId: null }, // If nullable during migration
})

for (const teacher of teachers) {
  // Find or create Person by email
  let person = await prisma.person.findFirst({
    where: {
      contactPoints: {
        some: {
          type: 'EMAIL',
          value: teacher.email,
        },
      },
    },
  })

  if (!person) {
    // Create Person
    person = await prisma.person.create({
      data: {
        name: teacher.name,
        contactPoints: {
          create: [
            { type: 'EMAIL', value: teacher.email, isPrimary: true },
            ...(teacher.phone
              ? [{ type: 'PHONE', value: teacher.phone, isPrimary: true }]
              : []),
          ],
        },
      },
    })
  }

  // Link Teacher to Person
  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { personId: person.id },
  })
}
```

---

## Summary

**Teacher Design**:

- ✅ Linked to `Person` (not separate identity)
- ✅ One `Teacher` per `Person` (unique `personId`)
- ✅ Contact info via `Person.contactPoints`
- ✅ Can have multiple roles simultaneously

**Role Combinations**:

- Teacher + Parent ✅
- Teacher + Student ✅
- Teacher + Payer ✅
- Teacher + Parent + Student + Payer ✅

**All through one `Person` record** with multiple role relationships.
