# Unified Student Platform - Complete Documentation

## 1. Purpose

Centralize decisions, requirements, and implementation status for Irshad Center's unified identity platform that refactors the student data model from a monolithic `Student` table to a flexible, multi-program system.

## 2. Current Pain Points (Resolved)

- Single `Student` table mixed identity, program-specific fields, enrollment lifecycle, and billing state → **Resolved with Person/ProgramProfile separation**
- Global unique email/phone prevented students/guardians from spanning programs → **Resolved with ContactPoint model**
- Status toggles overwrote history → **Resolved with Enrollment time-bounded records**
- Billing fields allowed only one Mahad + one Dugsi subscription per student → **Resolved with BillingAccount/BillingAssignment model**
- Upcoming youth/donor flows needed shared payers and initiative-specific data → **Resolved with metadata JSONB**

## 3. Programs & Initiatives

| Program / Initiative                  | Participants         | Unique needs today                                                                                                         | Anticipated additions                     |
| ------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Mahad (College)                       | Adult students       | Education history, graduation years, tuition plans, **batches** (cohorts)                                                  | Tracks (full/part time), academic advisor |
| Dugsi (K-12)                          | Children + guardians | Gender, guardian contacts, family reference, health info, **teacher assignments** (morning/evening shifts), **no batches** | Behavior notes, transportation            |
| Youth Events                          | Teens + parents      | Waivers, emergency contacts, event sessions                                                                                | Merchandise sizes, volunteer roles        |
| General Donations / Special Campaigns | Donors/guardians     | Fund designation, recurring amount                                                                                         | Employer matching, pledge tracking        |

**Decision**: Core shared fields are typed; metadata JSONB used for initiative-only fields.

## 4. Target Data Model

### Identity Layer

- **`Person`**: Canonical profile (name, DOB, preferred language). One record per human being.
- **`ContactPoint`**: Multiple emails/phones (type, verified flag); uniqueness enforced at contact level.
- **`GuardianRelationship`**: Links guardians/donors to dependents (role, start/end dates).
- **`SiblingRelationship`**: Tracks sibling relationships across all programs for discount management (replaces legacy `Sibling` table).
- **`Teacher`**: Staff role linked to Person (one Teacher per Person). Allows teachers to also be parents, payers, or students through the same Person record.

### Program Participation Layer

- **`ProgramProfile`**: One per person per program/initiative; stores base fields + `metadata` JSONB.
- **`Enrollment`**: Time-bounded participation records (status, cohort/event, reason codes).
- **`Batch`**: Mahad-only cohorts/groups (Dugsi does not use batches).
- **`TeacherAssignment`**: Dugsi-only teacher-to-student assignments with shifts (morning/evening). Links Teacher to Dugsi ProgramProfile.

### Billing Layer

- **`BillingAccount`**: Payer entity with Stripe customer IDs per Stripe account (Mahad, Dugsi, Youth, Donation) and ACH metadata.
- **`Subscription`**: Stripe subscription/payment intent references with plan/amount/status.
- **`BillingAssignment`**: Connects subscriptions (or fractions) to program profiles/enrollments.
- **`SubscriptionHistory`**: Audit log of Stripe events.
- **`StudentPayment`**: Payment records linked to ProgramProfile (replaces legacy studentId).

### Removed Models (Incomplete Features)

- `Attendance`, `AttendanceRecord`, `AttendanceSession`: Attendance tracking removed (will be redesigned per program).
- `ClassSchedule`, `ClassSession`, `Subject`, `Semester`: Class scheduling removed (each program will have different scheduling needs).

All tables live in current Postgres DB. Legacy `Student` table was dropped; schema cleanup completed.

## 5. Implementation Status

### Phase 1: Schema & Foundation (COMPLETE)

**Database Schema:**

- Created `Person` table (canonical identity)
- Created `ContactPoint` table (multiple emails/phones per person)
- Created `GuardianRelationship` table (guardian → dependent links)
- Created `SiblingRelationship` table (sibling tracking across programs)
- Created `ProgramProfile` table (one per person per program, with metadata JSONB)
- Created `Enrollment` table (time-bounded enrollment records)
- Created `BillingAccount` table (payer entity with Stripe customer IDs)
- Created `Subscription` table (Stripe subscription records)
- Created `BillingAssignment` table (links subscriptions to profiles)
- Created `SubscriptionHistory` table (audit log)
- Created `Teacher` table (linked to Person as role)
- Created `TeacherAssignment` table (Dugsi teacher-student assignments with shifts)
- Created `Batch` table (Mahad-only cohorts)
- Removed legacy models: `Student`, `Sibling`, `Attendance`, `ClassSchedule`, etc.
- Database CHECK constraints added (Dugsi batchId prevention, guardian self-reference, sibling ordering)
- Composite indexes added for query optimization
- Status field normalized (ProgramProfile.status → EnrollmentStatus enum)
- Legacy fields removed (legacyStudentId, legacyParentEmail, etc.)

**Type Definitions:**

- `lib/types/person.ts` - Person, ContactPoint, GuardianRelationship types
- `lib/types/program-profile.ts` - ProgramProfile types with metadata config
- `lib/types/enrollment.ts` - Enrollment types with status helpers
- `lib/types/billing.ts` - BillingAccount, Subscription, BillingAssignment types
- `lib/types/siblings.ts` - SiblingRelationship types
- `lib/types/teacher.ts` - Teacher and TeacherAssignment types

**Query Layer:**

- `lib/db/queries/program-profile.ts` - Program profile queries (get, search, filter)
- `lib/db/queries/billing.ts` - Billing account and subscription queries
- `lib/db/queries/siblings.ts` - Sibling relationship queries
- `lib/db/queries/teacher.ts` - Teacher and assignment queries

**Services:**

- `lib/services/billing-matcher.ts` - Matches Stripe checkout sessions to billing accounts/profiles
- `lib/services/sibling-detector.ts` - Detects sibling relationships via guardian/name/contact matching
- `lib/services/validation-service.ts` - Application-level validation (Dugsi batchId, guardian self-reference, etc.)

**Admin UI:**

- `app/admin/siblings/` - Sibling management interface
- `app/api/admin/siblings/detect/` - Sibling detection API
- `app/api/admin/siblings/cross-program/` - Cross-program sibling queries

**Scripts:**

- `scripts/validate-migration.ts` - Validates migration results
- `scripts/db-safety-check.ts` - Environment safety checks
- `scripts/safe-migrate-reset.ts` - Safe database reset wrapper

**Documentation:**

- `docs/DATABASE_SAFETY.md` - Safety protocol
- `docs/ENVIRONMENT_GUIDE.md` - Environment setup guide
- `docs/TEACHER_ROLE_DESIGN.md` - Teacher as Person role design
- `docs/DUGSI_TEACHER_SHIFTS.md` - Dugsi teacher assignment system
- `docs/TEACHER_MIGRATION_PLAN.md` - Migration guide for existing teachers
- `docs/BATCH_MAHAD_ONLY.md` - Batch model documentation
- `docs/COMPLETE_SCHEMA_REVIEW.md` - Complete schema review

### 🚧 Phase 2: Application Refactor (IN PROGRESS)

**Remaining Work:**

1. **Registration Actions** (HIGH PRIORITY)
   - [ ] Update `app/mahad/(registration)/register/_actions/index.ts`
     - Create Person → ContactPoints → ProgramProfile → Enrollment
     - Handle guardian relationships for siblings
   - [ ] Update `app/dugsi/register/actions.ts`
     - Create Person for each child + guardian Person
     - Create GuardianRelationships
     - Create ProgramProfiles + Enrollments
     - Create BillingAccount for parent

2. **Admin Actions** (HIGH PRIORITY)
   - [ ] Update `app/admin/mahad/cohorts/actions.ts`
     - Use `Enrollment` for batch assignments
     - Update enrollment status instead of Student.status
   - [ ] Update `app/admin/dugsi/actions.ts`
     - Use ProgramProfile queries
     - Update enrollments for status changes
   - [ ] Update `app/admin/link-subscriptions/actions.ts`
     - Use BillingAccount/Subscription/BillingAssignment
     - Match orphaned subscriptions to billing accounts

3. **Stripe Integration** (HIGH PRIORITY)
   - [ ] Update `app/api/webhook/route.ts` (Mahad webhooks)
     - Use `billingMatcher` instead of `studentMatcher`
     - Create/update BillingAccount and Subscription
     - Create BillingAssignment to link subscription to profile
   - [ ] Update `app/api/webhook/dugsi/route.ts` (Dugsi webhooks)
     - Same updates as Mahad webhooks

4. **UI Components** (MEDIUM PRIORITY)
   - [ ] Update `app/admin/mahad/cohorts/page.tsx` and components
     - Fetch via `getProgramProfiles` instead of `getStudents`
     - Display enrollment status
   - [ ] Update `app/admin/dugsi/page.tsx` and components
     - Use ProgramProfile queries
     - Show guardian relationships
   - [ ] Update `app/admin/link-subscriptions` components
     - Show BillingAccount instead of Student
     - Allow assigning subscriptions to multiple profiles

5. **Testing** (MEDIUM PRIORITY)
   - [ ] Add Vitest tests for new query functions
   - [ ] Add integration tests for billing matcher
   - [ ] Test migration script on staging data
   - [ ] Validate data integrity after migration

## 6. Workflow Coverage

- **Mahad self-pay student**: Person → Mahad profile → enrollment (with batchId); checkout creates Stripe customer → BillingAccount (self) → Subscription linked via BillingAssignment.
- **Mahad sibling payer**: Same billing account funds multiple Mahad profiles/enrollments, each with its own assignment (multiple subscriptions or split amounts). All enrollments linked to batches.
- **Dugsi family**: Guardian billing account created after ACH capture; admin-created subscription assigned to each child profile. Each child has teacher assignments (TeacherAssignment) with shifts (morning/evening). No batches used.
- **Dugsi teacher workflow**: Teacher is a role on Person (not separate identity). Teacher can be assigned to multiple Dugsi students via TeacherAssignment. Teacher can also be a parent, payer, or student themselves through the same Person record.
- **Teacher-parent-payer**: Single Person can be teacher (staff), parent (has children), payer (pays for children), and student (enrolled in programs) simultaneously. All roles linked to same Person record.
- **Youth/donor**: Donor-only ProgramProfile (metadata-driven) + billing account; later conversions re-use same Person and contact data.
- **Sibling discount workflow**: SiblingRelationship tracks siblings across all programs; automatic detection via shared guardians (children) or name/contact matching (adults); manual override available; discount eligibility flagged for admin review.

## 7. Teacher Role Implementation

### Design

- Teacher is a **role on Person** (not separate identity)
- One Teacher per Person (unique `personId`)
- Contact info via `Person.contactPoints`
- Can have multiple roles simultaneously (teacher + parent + payer + student)

### Key Features

**1. Person-Based Identity**

- Teacher linked to Person via `personId` (unique, required)
- Removed `name`, `email`, `phone` fields from Teacher model
- All contact info managed through Person.contactPoints

**2. Multiple Roles Support**
A single Person can be:

- **Teacher** (staff member)
- **Parent/Guardian** (has children)
- **Payer** (pays for subscriptions)
- **Student** (enrolled in programs)

**3. Dugsi Teacher Assignments**

- `TeacherAssignment` links teachers to Dugsi students
- Includes shift (MORNING/EVENING)
- Tracks assignment history
- Application-level validation required (Dugsi-only)

**4. Query Helpers**

- `getTeacherById`, `getTeacherByPersonId`
- `getTeacherWithPersonRelations`
- `getAllTeachers` (with search)
- `getTeacherAssignments` (by teacher)
- `getStudentTeacherAssignments` (by student)
- `getDugsiTeachersByShift`
- `isPersonATeacher`
- `getPersonRoles` (check all roles for a person)

### Validation Rules (Application-Level)

1. **TeacherAssignment Only for Dugsi**:

   ```typescript
   if (programProfile.program !== 'DUGSI_PROGRAM') {
     throw new Error('Teacher assignments are only for Dugsi program')
   }
   ```

2. **One Teacher Per Person**:

   ```typescript
   const existing = await prisma.teacher.findUnique({
     where: { personId },
   })
   if (existing) {
     throw new Error('Person is already a teacher')
   }
   ```

3. **One Active Assignment Per Student/Shift**:
   ```typescript
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

### Related Documentation

- `docs/TEACHER_ROLE_DESIGN.md` - Complete role design
- `docs/DUGSI_TEACHER_SHIFTS.md` - Dugsi teacher assignments
- `docs/TEACHER_MIGRATION_PLAN.md` - Migration guide
- `docs/TEACHER_ASSIGNMENT_EXPLANATION.md` - TeacherAssignment explanation

## 8. Hybrid Metadata Strategy

- **Core columns** (on `ProgramProfile`): status, tuition rate, guardian link, gender, academic level, health flags where broadly needed.
- **Metadata JSONB**:
  - Stored per profile with keys defined by program configs.
  - Validated via program-specific Zod schema (e.g., `programMetadataSchemas['youth']`).
  - UI renders dynamic sections by iterating config definitions (field name, component type, validation).
- **Pros**: Flexible for new initiatives, no DB migration for one-off fields.
- **Cons mitigated by**: Centralized validation + typed adapters when metadata fields need reporting.

## 9. Architecture Overview

### Old Model (Monolithic)

```
Student {
  id, name, email, phone, status, program,
  batchId, stripeCustomerId, stripeSubscriptionId,
  guardianEmail, guardianPhone, ...
}
```

**Problems:**

- Single table mixes identity, program data, enrollment, and billing
- Global unique email/phone prevents multi-program participation
- Status toggles overwrite history
- One subscription per student (can't split payments)

### New Model (Unified Identity)

```
Person (canonical identity)
├── ContactPoint[] (multiple emails/phones)
├── GuardianRelationship[] (guardian → dependent)
├── SiblingRelationship[] (sibling tracking)
├── ProgramProfile[] (one per program)
│   ├── Enrollment[] (time-bounded records)
│   └── BillingAssignment[] (subscription links)
├── Teacher (role on Person)
│   └── TeacherAssignment[] (Dugsi assignments)
└── BillingAccount (payer entity)
    └── Subscription[] (Stripe subscriptions)
        └── BillingAssignment[] (links to profiles)
```

**Benefits:**

- Person can have multiple ProgramProfiles (Mahad + Dugsi + Youth)
- Full enrollment history (multiple Enrollment records per profile)
- Flexible billing (one BillingAccount can pay for multiple profiles)
- Sibling relationships tracked across all programs
- Metadata JSONB for program-specific fields (no migrations needed)
- Teacher as role on Person (can be parent/payer/student simultaneously)

## 10. Key Design Decisions

1. **Metadata Storage**: Using JSONB column on `ProgramProfile.metadata`
   - Flexible for new initiatives
   - No migrations needed for one-off fields
   - Validated via program-specific Zod schemas

2. **Guardian Relationships**: Simple relationship records
   - No consent logging needed
   - Supports multiple guardians per dependent
   - Tracks start/end dates

3. **Stripe Assignment**: Supporting split amounts
   - `BillingAssignment.amount` and `percentage` fields
   - One subscription can fund multiple profiles
   - Tracks allocation per profile

4. **Sibling Tracking**: Using `SiblingRelationship` table
   - Replaces legacy `Sibling` table
   - Detection methods: guardian match (children), name/contact match (adults), manual override
   - Confidence scoring and verification tracking

5. **Enrollment Model**: Time-bounded records
   - Full history (join/leave/rejoin)
   - Status transitions tracked per enrollment
   - Links to Batch for cohort management (Mahad only)

6. **Teacher Design**: Teacher is a role on Person
   - Not separate identity
   - Allows teachers to be parents, payers, or students simultaneously
   - One Teacher per Person (unique personId)

7. **Program-Specific Structures**:
   - Mahad uses batches (cohorts)
   - Dugsi uses teacher assignments with shifts (no batches)
   - Each program optimized for its needs

## 11. Critical Safety Rules

**NEVER:**

- Run `prisma migrate reset` directly (use `scripts/safe-migrate-reset.ts`)
- Drop tables or delete migration files
- Skip environment validation checks
- Modify production database without backup

**ALWAYS:**

- Run `scripts/db-safety-check.ts` before destructive operations
- Set `DATABASE_ENV` environment variable
- Test migrations on staging first
- Create backups before production changes

## 12. Next Actions

1. **Application Refactor** (Priority):
   - Inventory all application touchpoints that read/write `Student` → Update to use `ProgramProfile`/`Person`
   - Update Mahad cohorts UI to use enrollments and batches
   - Update Dugsi admin UI to use teacher assignments
   - Update registration flows to create Person → Profile → Enrollment

2. **Validation Implementation** (Priority):
   - ✅ Add application-level validation: Dugsi enrollments cannot have batchId (Database CHECK constraint added)
   - ✅ Add validation: Guardian cannot be their own dependent (Database CHECK constraint added)
   - [ ] Add validation: BillingAssignment amounts don't exceed subscription
   - ✅ Add validation: TeacherAssignment only for Dugsi ProgramProfiles (Application-level)

3. **Stripe Integration**:
   - Update webhook handlers to use billing matcher
   - Update link-subscriptions UI to work with billing assignments
   - Support multiple subscriptions per payer

4. **Testing & Documentation**:
   - Add tests for new query functions and services
   - Add tests for teacher assignment workflows
   - Add tests for multi-role Person scenarios
   - Update architecture documentation
   - Create admin runbooks for new workflows

## 13. Related Documentation

- `docs/DATABASE_SAFETY.md` - Database safety protocol
- `docs/ENVIRONMENT_GUIDE.md` - Environment setup guide
- `docs/ARCHITECTURE.md` - System architecture
- `docs/COMPLETE_SCHEMA_REVIEW.md` - Complete schema review
- `docs/SCHEMA_REVIEW_ISSUES.md` - Schema review issues
- `docs/SCHEMA_REDESIGN_RECOMMENDATIONS.md` - Schema redesign recommendations
- `docs/TEACHER_ROLE_DESIGN.md` - Teacher role design
- `docs/DUGSI_TEACHER_SHIFTS.md` - Dugsi teacher shifts
- `docs/TEACHER_MIGRATION_PLAN.md` - Teacher migration plan
- `docs/BATCH_MAHAD_ONLY.md` - Batch model documentation

---

**Last Updated**: January 2025  
**Status**: Phase 1 Complete, Phase 2 In Progress
