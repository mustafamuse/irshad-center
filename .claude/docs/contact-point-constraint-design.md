# ContactPoint Unique Constraint Design Review

This document provides full context for evaluating the unique constraint design on the `ContactPoint` table. Two approaches are compared: the current unconditional indexes vs. partial indexes that only cover active rows.

---

## 1. Schema

### ContactPoint Model (prisma/schema.prisma)

```prisma
model ContactPoint {
  id            String       @id @default(uuid())
  personId      String
  person        Person       @relation(fields: [personId], references: [id], onDelete: Cascade)
  type          ContactType
  value         String
  isPrimary     Boolean      @default(true)
  isActive      Boolean      @default(true)
  deactivatedAt DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@unique([type, value, isActive], name: "unique_active_contact_globally")
  @@unique([personId, type, value], name: "unique_contact_per_person")
  @@index([personId, type])
}

enum ContactType {
  EMAIL
  PHONE
}
```

Schema comments state:

> `isActive Boolean @default(true) // Soft-delete: allows email/phone reuse after deactivation`
> `// Unique constraint includes isActive to allow reuse of deactivated contacts`
> `// Only active contacts enforce global uniqueness per type+value`

### Person Model (relevant relation)

```prisma
model Person {
  id              String          @id @default(uuid())
  name            String
  contactPoints   ContactPoint[]
  // ... other relations
}
```

---

## 2. Actual SQL Constraints

### From migration `20251125000000_unified_identity_schema/migration.sql`

```sql
-- Per-person: a person cannot have two rows with the same (type, value), regardless of isActive
CREATE UNIQUE INDEX "ContactPoint_personId_type_value_key"
  ON "ContactPoint"("personId", "type", "value");

-- Global: enforces uniqueness on (type, value, isActive) across all persons
CREATE UNIQUE INDEX "ContactPoint_type_value_isActive_key"
  ON "ContactPoint"("type", "value", "isActive");
```

Both are **unconditional** — they cover all rows, active and deactivated.

### Existing partial index precedent

From migration `20251130_add_primary_contact_unique_index/migration.sql`:

```sql
-- Ensures only one primary contact per person per type
-- This is a partial index that only applies when isPrimary = true
CREATE UNIQUE INDEX "ContactPoint_one_primary_per_person_type"
  ON "ContactPoint" ("personId", "type")
  WHERE "isPrimary" = true;
```

This demonstrates the team already uses raw SQL partial indexes for ContactPoint.

---

## 3. What Each Constraint Actually Enforces

### `unique_contact_per_person`: `UNIQUE (personId, type, value)`

A person can hold any given `(type, value)` pair **at most once** across their entire history. Once a contact is soft-deleted, that slot is permanently occupied for that person. The only way to "reuse" it is to:

- Hard-delete the old row first, OR
- Reactivate the existing row in place

### `unique_active_contact_globally`: `UNIQUE (type, value, isActive)`

Because `isActive` is boolean (only `true` or `false`), this creates exactly **two slots** per `(type, value)`:

| Slot     | Tuple                         | Meaning                               |
| -------- | ----------------------------- | ------------------------------------- |
| Active   | `(EMAIL, foo@bar.com, true)`  | At most 1 active record globally      |
| Inactive | `(EMAIL, foo@bar.com, false)` | At most 1 deactivated record globally |

The **intended** behavior was: "only active contacts enforce global uniqueness." But the **actual** behavior also limits deactivated records to 1 per value globally.

---

## 4. Architecture Rules

From `.claude/rules/architecture.md`:

> **ContactPoint Rules:**
>
> 1. Always set `isPrimary: true` on `contactPoint.create`
> 2. Always filter `isActive: true` when looking up existing contact points — never match soft-deleted records
> 3. Never try-catch P2002 inside `$transaction()` — PostgreSQL aborts the transaction on constraint violations
> 4. Validate input before opening a transaction

---

## 5. Current Service Code Patterns

### 5a. `updateGuardianInfo` — delete-before-update pattern

**File: `lib/services/shared/parent-service.ts`**

This function runs inside `$transaction()`. When updating a guardian's email:

```typescript
if (existingEmail) {
  // Guard: check for a deactivated row with the NEW value
  // If found, hard-delete it to clear the unique_contact_per_person slot
  const conflictingEmail = await tx.contactPoint.findFirst({
    where: {
      personId: guardianId,
      type: 'EMAIL',
      value: normalizedEmail,
      isActive: false,
    },
  })
  if (conflictingEmail) {
    await tx.contactPoint.delete({ where: { id: conflictingEmail.id } })
  }
  await tx.contactPoint.update({
    where: { id: existingEmail.id },
    data: { value: normalizedEmail },
  })
} else {
  // Guard: check for a deactivated row to reactivate instead of creating
  const deactivatedEmail = await tx.contactPoint.findFirst({
    where: {
      personId: guardianId,
      type: 'EMAIL',
      value: normalizedEmail,
      isActive: false,
    },
  })
  if (deactivatedEmail) {
    logger.info(
      { guardianId, contactId: deactivatedEmail.id, type: 'EMAIL' },
      'Reactivating deactivated email contact'
    )
    await tx.contactPoint.update({
      where: { id: deactivatedEmail.id },
      data: { isActive: true, isPrimary: true, deactivatedAt: null },
    })
  } else {
    await tx.contactPoint.create({
      data: {
        personId: guardianId,
        type: 'EMAIL',
        value: normalizedEmail,
        isPrimary: true,
      },
    })
  }
}
```

**Key observation**: The `delete` call on the deactivated row permanently destroys the audit trail for that contact. The soft-delete intent (preserve history) is defeated.

### 5b. `createMahadStudent` — read-first-for-deactivated pattern

**File: `lib/services/mahad/student-service.ts` (lines 96-158)**

When a duplicate person is found and their contact needs attaching:

```typescript
const emailContact = dupResult.existingPerson.contactPoints.find(
  (cp) => cp.type === 'EMAIL' && cp.value === normalizedEmail
)
if (!emailContact) {
  // No active match — check for deactivated same-value
  const deactivatedEmail = await tx.contactPoint.findFirst({
    where: { personId, type: 'EMAIL', value: normalizedEmail, isActive: false },
  })
  if (deactivatedEmail) {
    await tx.contactPoint.update({
      where: { id: deactivatedEmail.id },
      data: { isActive: true, isPrimary: true, deactivatedAt: null },
    })
  } else {
    await tx.contactPoint.create({
      data: {
        personId,
        type: 'EMAIL',
        value: normalizedEmail,
        isPrimary: true,
      },
    })
  }
}
```

### 5c. `updateMahadStudent` — MISSING guard (latent bug)

**File: `lib/services/mahad/student-service.ts` (lines 262-321)**

```typescript
const existingEmail = await tx.contactPoint.findFirst({
  where: { personId: personId, type: 'EMAIL' },
  // NOTE: no isActive filter — picks up deactivated rows too
})
if (normalizedEmail) {
  if (existingEmail) {
    await tx.contactPoint.update({
      where: { id: existingEmail.id },
      data: {
        value: normalizedEmail,
        isActive: true,
        deactivatedAt: null,
      },
    })
  } else {
    await tx.contactPoint.create({
      data: {
        personId: personId,
        type: 'EMAIL',
        value: normalizedEmail,
        isPrimary: true,
      },
    })
  }
}
```

**Bug**: If the person has an active email A and a deactivated email B, and admin updates to value B:

- `findFirst({ personId, type: 'EMAIL' })` might return either row (no ordering guarantee)
- If it returns the active row (A) and tries to update its value to B → P2002 on `unique_contact_per_person` because B already exists as a deactivated row
- No delete-before-update guard exists here

### 5d. Admin deactivation — `updateStudentAction`

**File: `app/admin/mahad/_actions/index.ts` (lines 673-722)**

```typescript
// When admin clears the email field:
if (existingEmail) {
  await tx.contactPoint.update({
    where: { id: existingEmail.id },
    data: { isActive: false, deactivatedAt: new Date() },
  })
}
```

**No collision guard.** If another person previously deactivated the same email globally, this update produces `(EMAIL, same@example.com, false)` which collides with the existing deactivated row on `unique_active_contact_globally`.

### 5e. Admin deactivation — `updateTeacherDetailsAction`

**File: `app/admin/dugsi/teachers/actions.ts` (lines 525-568)**

```typescript
// When admin clears the email field:
if (existingEmail) {
  await tx.contactPoint.update({
    where: { id: existingEmail.id },
    data: { isActive: false }, // NOTE: doesn't even set deactivatedAt
  })
}
```

Same collision vulnerability as 5d, plus missing `deactivatedAt` timestamp.

---

## 6. Backfill Migration (Documents the Constraint Limitation)

**File: `prisma/migrations/20260325120000_backfill_phone_digits_only/migration.sql`**

This migration normalized phone numbers to digits-only format. It had to work around both constraints:

```sql
-- Step 0: Delete older INACTIVE duplicates that would collide after normalization
-- The @@unique([type, value, isActive]) constraint applies to inactive rows too.
-- Inactive contacts cannot be deactivated further, so duplicates must be deleted.
WITH inactive_dupes AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY type, regexp_replace(value, '[^0-9]', '', 'g'), "isActive"
    ORDER BY "updatedAt" DESC
  ) AS rn
  FROM "ContactPoint"
  WHERE type IN ('PHONE', 'WHATSAPP') AND "isActive" = false
)
DELETE FROM "ContactPoint" WHERE id IN (
  SELECT id FROM inactive_dupes WHERE rn > 1
);

-- Step 1: Deactivate older SAME-PERSON active duplicates
-- unique_contact_per_person covers active+inactive, so we must deactivate,
-- not just skip — otherwise the normalized value collides with the kept row.
WITH active_person_dupes AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "personId", type, regexp_replace(value, '[^0-9]', '', 'g')
    ORDER BY "updatedAt" DESC
  ) AS rn
  FROM "ContactPoint"
  WHERE type IN ('PHONE', 'WHATSAPP') AND "isActive" = true
)
UPDATE "ContactPoint"
SET "isActive" = false, "deactivatedAt" = NOW()
WHERE id IN (SELECT id FROM active_person_dupes WHERE rn > 1);

-- Step 1b: Deactivate older CROSS-PERSON active duplicates
-- unique_active_contact_globally allows only one active contact per (type, value)
WITH active_global_dupes AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY type, regexp_replace(value, '[^0-9]', '', 'g')
    ORDER BY "updatedAt" DESC
  ) AS rn
  FROM "ContactPoint"
  WHERE type IN ('PHONE', 'WHATSAPP') AND "isActive" = true
)
UPDATE "ContactPoint"
SET "isActive" = false, "deactivatedAt" = NOW()
WHERE id IN (SELECT id FROM active_global_dupes WHERE rn > 1);

-- Step 2: Now safe to normalize
UPDATE "ContactPoint"
SET value = regexp_replace(value, '[^0-9]', '', 'g')
WHERE type IN ('PHONE', 'WHATSAPP')
  AND value ~ '[^0-9]';
```

The 3-step ceremony was entirely caused by constraints covering inactive rows.

---

## 7. Bug Scenarios

### Scenario A: Cross-Person Deactivation Collision

Caused by `unique_active_contact_globally` only allowing 1 inactive record per value globally.

| Step | Action                                  | DB State                                                         | Result                                             |
| ---- | --------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| 1    | Alice registers with shared@example.com | `(Alice, EMAIL, shared@, true)`                                  | OK                                                 |
| 2    | Admin clears Alice's email              | `(Alice, EMAIL, shared@, false)`                                 | OK — inactive slot taken                           |
| 3    | Bob registers with shared@example.com   | `(Alice, EMAIL, shared@, false)` + `(Bob, EMAIL, shared@, true)` | OK                                                 |
| 4    | Admin clears Bob's email                | Tries to write `(Bob, EMAIL, shared@, false)`                    | **P2002** — Alice's row occupies the inactive slot |

**No code path handles this today.** The admin gets an unhandled error.

### Scenario B: Same-Person Value Update Collision

Caused by `unique_contact_per_person` covering deactivated rows.

| Step | Action                                                        | DB State                                                           | Result                                                         |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1    | Guardian has old@example.com                                  | `(Guardian, EMAIL, old@, true)`                                    |                                                                |
| 2    | Guardian's email was previously new@example.com (deactivated) | `(Guardian, EMAIL, old@, true)` + `(Guardian, EMAIL, new@, false)` |                                                                |
| 3    | Admin updates email to new@example.com                        | Updates active row's value: old@ → new@                            | **P2002** — deactivated row occupies `(Guardian, EMAIL, new@)` |

**Current workaround**: `updateGuardianInfo` has a delete-before-update guard that hard-deletes the deactivated row before updating. `updateMahadStudent` does NOT have this guard (latent bug).

### Scenario C: Returnee Reactivation

A student withdraws and later re-enrolls with the same email.

| Step | Action                               | DB State                                         | Result                                    |
| ---- | ------------------------------------ | ------------------------------------------------ | ----------------------------------------- |
| 1    | Student enrolled, email active       | `(Student, EMAIL, student@, true)`               |                                           |
| 2    | Student withdraws, email deactivated | `(Student, EMAIL, student@, false)`              |                                           |
| 3    | Student re-enrolls with same email   | Must reactivate existing row, not create new one | `unique_contact_per_person` blocks create |

**Both approaches handle this the same way**: code must find and reactivate the existing deactivated row. `createMahadStudent` has this logic. Under Approach B, a create would also work (the partial index ignores the deactivated row), but reactivation is still preferred to avoid duplicates.

### Scenario D: Round-Trip Email Change (A → B → A)

| Step             | Approach A (Unconditional)                                                    | Approach B (Partial)                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Start            | `(Person, EMAIL, A, true)`                                                    | `(Person, EMAIL, A, true)`                                                                                            |
| Change to B      | Update active row: A→B. One row: `(Person, EMAIL, B, true)`. No history of A. | Could soft-delete A, create B. Two rows: `(Person, EMAIL, A, false)` + `(Person, EMAIL, B, true)`. History preserved. |
| Change back to A | Update active row: B→A. One row: `(Person, EMAIL, A, true)`. No history of B. | Soft-delete B, create A (or reactivate old A). Three rows: `(A, false)` + `(B, false)` + `(A, true)`. Full history.   |

Under Approach A, in-place updates are forced (to avoid constraint collisions), so no audit trail survives. Under Approach B, soft-delete + create is possible, preserving complete history.

---

## 8. The Two Approaches

### Approach A: Unconditional Indexes (Current)

```sql
CREATE UNIQUE INDEX ON "ContactPoint"("personId", "type", "value");
CREATE UNIQUE INDEX ON "ContactPoint"("type", "value", "isActive");
```

**Invariants enforced:**

- A person holds each `(type, value)` at most once across their entire lifetime
- At most 1 active AND 1 inactive record per `(type, value)` globally

**Guard code required in services:**

- `delete-before-update`: when changing an active contact's value, must first delete any deactivated row with the new value for the same person
- `read-first-for-deactivated`: when creating a contact, must first check if a deactivated row exists for that person+type+value and reactivate it instead
- Deactivation guard (not yet implemented): when deactivating, must handle the case where the global inactive slot is already occupied by another person

**Scenario outcomes:**

- A: Cross-person deactivation crashes (unhandled bug)
- B: Requires delete-before-update guard (partially implemented)
- C: Requires read-first reactivation (implemented in createMahadStudent, updateGuardianInfo)
- D: In-place updates only — no audit trail

**Audit trail:** Partially destroyed. The delete-before-update pattern permanently erases deactivated rows. Soft-delete's stated purpose (preserve history) is defeated.

**Migration complexity:** High. The phone normalization migration required a 3-phase delete/deactivate/normalize ceremony.

**Prisma compatibility:** Full. `@@unique` is natively supported and visible in the schema.

### Approach B: Partial Indexes

```sql
CREATE UNIQUE INDEX ON "ContactPoint"("personId", "type", "value")
  WHERE "isActive" = true;
CREATE UNIQUE INDEX ON "ContactPoint"("type", "value")
  WHERE "isActive" = true;
```

**Invariants enforced:**

- A person holds each `(type, value)` at most once among their **active** contacts
- At most 1 active record per `(type, value)` globally
- No constraints on deactivated rows

**Guard code required in services:**

- No delete-before-update needed (deactivated rows don't participate in constraint)
- No deactivation guard needed (inactive slot is unconstrained)
- Read-first-for-deactivated is still recommended (to avoid accumulating duplicate inactive rows for the same person), but it's a data hygiene concern, not a crash prevention

**Scenario outcomes:**

- A: Works naturally. Both deactivations succeed.
- B: Works naturally. No collision between active and deactivated rows.
- C: Create works (no constraint collision). Reactivation is optional but preferred for data hygiene.
- D: Soft-delete + create preserves full history. Three rows after round-trip.

**Audit trail:** Fully preserved. No hard deletes needed. Every contact value a person ever used has a permanent row with timestamps.

**Migration complexity:** Low. Only active rows matter for constraints. The phone normalization migration could have been a single UPDATE.

**Prisma compatibility:** Partial. Cannot be expressed via `@@unique` in the schema. Requires raw SQL in a migration file. The constraint is invisible to `prisma format`, `prisma validate`, and schema introspection. **However**, there is already a precedent: `ContactPoint_one_primary_per_person_type` is a partial index created via raw SQL migration.

**Table growth:** Inactive rows accumulate over time. A person who changes email 10 times has 10 deactivated rows. May need periodic archival.

**Weaker invariant:** The database no longer prevents a person from having 2 inactive rows with the same value. Application layer must manage this if it matters.

---

## 9. Migration Path (A → B)

Switching from unconditional to partial indexes requires:

1. **Verify no duplicate active rows exist** (they shouldn't, since the old constraint was stricter):

```sql
SELECT "personId", type, value, COUNT(*)
FROM "ContactPoint"
WHERE "isActive" = true
GROUP BY "personId", type, value
HAVING COUNT(*) > 1;
```

2. **Drop the old unconditional indexes:**

```sql
DROP INDEX "ContactPoint_personId_type_value_key";
DROP INDEX "ContactPoint_type_value_isActive_key";
```

3. **Create the new partial indexes:**

```sql
CREATE UNIQUE INDEX "ContactPoint_active_per_person"
  ON "ContactPoint"("personId", "type", "value")
  WHERE "isActive" = true;

CREATE UNIQUE INDEX "ContactPoint_active_globally"
  ON "ContactPoint"("type", "value")
  WHERE "isActive" = true;
```

4. **Remove `@@unique` directives from Prisma schema** and add a comment pointing to the raw SQL migration.

5. **Remove guard code** from services (delete-before-update in updateGuardianInfo, etc.) — these become unnecessary.

---

## 10. Questions for Reviewer

1. **Is the audit trail of deactivated contacts important?** The current approach destroys it via hard deletes in the delete-before-update pattern. The partial index approach preserves it.

2. **Is inactive row accumulation acceptable?** Under partial indexes, deactivated rows grow unbounded. Is periodic cleanup/archival worth the trade-off?

3. **Should the global constraint allow multiple deactivated records per value?** Currently, only 1 deactivated record per email/phone can exist globally — this causes Scenario A (cross-person deactivation crash). Is this an acceptable limitation or a real bug?

4. **Is Prisma schema invisibility acceptable?** Partial indexes require raw SQL and are invisible to Prisma tooling. There's already one precedent (`isPrimary` partial index). Is this a maintenance burden or an acceptable trade-off?

5. **Are there other approaches?** For example:
   - Hard delete instead of soft delete (simplest, no constraint issues, but no audit trail at all)
   - Soft delete with a `deletedAt` timestamp in the unique key instead of `isActive` boolean (allows unlimited deactivated rows per value)
   - Event log / history table instead of soft-delete flags on the main table
   - Application-level uniqueness checks only (no database constraints)

6. **What is the real-world frequency of the collision scenarios?** If email/phone reuse across persons is rare, the current design may be "good enough" with targeted bug fixes. If it's common, the constraint redesign is warranted.
