# Teacher Migration Plan - Linking to Person

## 🎯 Goal

Migrate `Teacher` model from standalone identity to role-based model linked to `Person`.

**Before**:
- Teacher had `name`, `email`, `phone` fields
- Teacher was a separate identity

**After**:
- Teacher linked to `Person` via `personId`
- Contact info via `Person.contactPoints`
- Teacher is a role, not separate identity

---

## Migration Steps

### Step 1: Make personId Optional (Temporary)

During migration, `personId` should be nullable to allow gradual migration:

```prisma
model Teacher {
  id        String   @id @default(uuid())
  personId  String?  @unique // Temporarily nullable
  // ... other fields ...
}
```

### Step 2: Create Migration Script

```typescript
// scripts/migrate-teachers-to-person.ts

import { prisma } from '@/lib/db'

async function migrateTeachersToPerson() {
  console.log('Starting teacher migration...')
  
  // Get all teachers without personId
  const teachers = await prisma.teacher.findMany({
    where: { personId: null },
    // Note: email/phone fields removed, so we'll need to handle existing data
  })
  
  console.log(`Found ${teachers.length} teachers to migrate`)
  
  for (const teacher of teachers) {
    try {
      // Strategy 1: Find existing Person by email (if email was stored)
      // Note: This assumes you have a way to get email from old Teacher records
      // You may need to query from a backup or migration table
      
      // Strategy 2: Create new Person
      const person = await prisma.person.create({
        data: {
          name: teacher.name, // Assuming name field exists
          contactPoints: {
            create: [
              // Add email if available
              // { type: 'EMAIL', value: teacher.email, isPrimary: true },
              // Add phone if available
              // { type: 'PHONE', value: teacher.phone, isPrimary: true },
            ]
          }
        }
      })
      
      // Link Teacher to Person
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { personId: person.id }
      })
      
      console.log(`✓ Migrated teacher ${teacher.id} → person ${person.id}`)
    } catch (error) {
      console.error(`✗ Failed to migrate teacher ${teacher.id}:`, error)
    }
  }
  
  console.log('Migration complete!')
}

migrateTeachersToPerson()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

### Step 3: Make personId Required

After all teachers are migrated:

```prisma
model Teacher {
  id        String   @id @default(uuid())
  personId  String   @unique // Now required
  // ... other fields ...
}
```

### Step 4: Remove Old Fields

Remove `name`, `email`, `phone` from Teacher model (already done in schema).

---

## Data Migration Considerations

### If You Have Existing Teacher Data

**Option 1: Manual Migration**
1. Export existing teacher data (name, email, phone)
2. Create Person records for each teacher
3. Create ContactPoint records from email/phone
4. Link Teacher to Person via personId

**Option 2: Automated Migration**
1. Run migration script to create Person records
2. Create ContactPoint records from email/phone
3. Link Teacher records to Person records

### Handling Duplicates

If a teacher's email already exists in Person (e.g., teacher is also a parent):

```typescript
// Check if Person exists by email
const existingPerson = await prisma.person.findFirst({
  where: {
    contactPoints: {
      some: {
        type: 'EMAIL',
        value: teacherEmail,
      }
    }
  }
})

if (existingPerson) {
  // Link Teacher to existing Person
  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { personId: existingPerson.id }
  })
} else {
  // Create new Person
  // ...
}
```

---

## Validation After Migration

### Check All Teachers Have personId

```typescript
const teachersWithoutPerson = await prisma.teacher.findMany({
  where: { personId: null }
})

if (teachersWithoutPerson.length > 0) {
  console.error(`Found ${teachersWithoutPerson.length} teachers without personId`)
}
```

### Check All Teachers Have Contact Points

```typescript
const teachers = await prisma.teacher.findMany({
  include: {
    person: {
      include: {
        contactPoints: true
      }
    }
  }
})

for (const teacher of teachers) {
  const hasEmail = teacher.person.contactPoints.some(
    cp => cp.type === 'EMAIL' && cp.verificationStatus !== 'INVALID'
  )
  
  if (!hasEmail) {
    console.warn(`Teacher ${teacher.id} has no valid email`)
  }
}
```

---

## Rollback Plan

If migration fails:

1. **Keep personId nullable** temporarily
2. **Restore name/email/phone** fields if needed
3. **Fix data issues** before retrying
4. **Re-run migration** after fixes

---

## Testing

### Test Cases

1. ✅ Create Teacher linked to existing Person
2. ✅ Create Teacher with new Person
3. ✅ Query Teacher with Person relations
4. ✅ Query Person with Teacher role
5. ✅ Check Teacher assignments still work
6. ✅ Verify contact info via Person.contactPoints

### Example Test

```typescript
// Test: Create teacher linked to person
const person = await prisma.person.create({
  data: {
    name: "Test Teacher",
    contactPoints: {
      create: [
        { type: 'EMAIL', value: 'teacher@example.com', isPrimary: true }
      ]
    }
  }
})

const teacher = await prisma.teacher.create({
  data: {
    personId: person.id
  },
  include: {
    person: {
      include: {
        contactPoints: true
      }
    }
  }
})

// Verify teacher has person
expect(teacher.personId).toBe(person.id)
expect(teacher.person.name).toBe("Test Teacher")
expect(teacher.person.contactPoints[0].value).toBe('teacher@example.com')
```

---

## Summary

**Migration Path**:
1. Make `personId` nullable temporarily
2. Create Person records for existing teachers
3. Create ContactPoint records from email/phone
4. Link Teacher records to Person records
5. Make `personId` required
6. Remove old fields (already done)

**Key Points**:
- ✅ Teachers become roles on Person
- ✅ Contact info moves to Person.contactPoints
- ✅ Teachers can have multiple roles (parent, payer, student)
- ✅ Single source of truth for identity

