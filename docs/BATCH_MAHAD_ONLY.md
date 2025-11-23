# Batch is Mahad-Only

## Important Constraint

**Batch (Cohort) is exclusive to the MAHAD_PROGRAM (college program).**

Dugsi (K-12 program) does **NOT** use batches.

## Schema Design

### Enrollment Model

```prisma
model Enrollment {
  batchId String? // MAHAD ONLY - Can be null for Dugsi, donations, or non-batch Mahad enrollments
  batch   Batch? @relation(...) // MAHAD ONLY
}
```

**Rules:**

- ✅ Mahad enrollments CAN have a `batchId`
- ✅ Dugsi enrollments MUST have `batchId = null`
- ✅ Donations/Youth enrollments MUST have `batchId = null`

### Batch Model

```prisma
// Batch (Cohort) - MAHAD ONLY
model Batch {
  id            String
  name          String @unique
  startDate     DateTime?
  endDate       DateTime?
  Enrollment    Enrollment[] // Only MAHAD_PROGRAM enrollments
  ClassSchedule ClassSchedule[] // Mahad class schedules
}
```

## Code Enforcement

### When Creating Enrollments

**Mahad Enrollment:**

```typescript
// ✅ Valid - Mahad can have batch
await prisma.enrollment.create({
  data: {
    programProfileId: mahadProfile.id,
    batchId: batch.id, // Optional but valid
    status: 'ENROLLED',
  },
})
```

**Dugsi Enrollment:**

```typescript
// ✅ Valid - Dugsi must NOT have batch
await prisma.enrollment.create({
  data: {
    programProfileId: dugsiProfile.id,
    batchId: null, // Must be null for Dugsi
    status: 'ENROLLED',
  },
})
```

### Validation Rules

1. **When creating/updating Enrollment:**
   - If `programProfile.program === 'DUGSI_PROGRAM'` → `batchId` must be `null`
   - If `programProfile.program === 'MAHAD_PROGRAM'` → `batchId` can be set or `null`

2. **When querying batches:**
   - Only query batches for Mahad students
   - Dugsi admin should never show batch selector

3. **When assigning students to batches:**
   - Only allow batch assignment for Mahad program profiles
   - Reject batch assignment for Dugsi program profiles

## Current Implementation

### Correct Usage

- `app/admin/mahad/cohorts/` - Batch management (Mahad only)
- `lib/db/queries/batch.ts` - Batch queries (no Dugsi references)
- Enrollment queries filter by program before batch operations

### Areas to Verify

- Registration flows should not assign batches to Dugsi enrollments
- Dugsi admin UI should not show batch selectors
- Enrollment update actions should validate program before allowing batch assignment

## Migration Notes

When migrating from Student to Enrollment:

- Mahad students with `batchId` → Create Enrollment with `batchId`
- Dugsi students (no `batchId`) → Create Enrollment with `batchId = null`

## Related Documentation

- `docs/ROUTING.md` - Program isolation patterns
- `docs/unified-student-platform.md` - Unified platform design
- `app/admin/mahad/cohorts/DATABASE_SCHEMA.md` - Mahad schema details
