# Mahad Database Schema

## Overview

The mahad system uses a **single database with program discrimination** to isolate Mahad (college) and Dugsi (K-12) data while sharing infrastructure.

---

## Core Models

### Student

**Primary table** for both Mahad and Dugsi students.

```prisma
model Student {
  // Identity
  id                    String          @id @default(cuid())
  name                  String
  email                 String?         @unique
  phone                 String?         @unique
  dateOfBirth           Date?

  // Program Isolation (CRITICAL)
  program               Program         @default(MAHAD_PROGRAM)

  // Status & Enrollment
  status                String          @default("registered")
  registeredAt          Date            @default(now())
  enrolledAt            Date?
  withdrawnAt           Date?

  // Academic
  educationLevel        EducationLevel?
  gradeLevel            GradeLevel?
  schoolName            String?

  // Mahad-Specific Fields
  monthlyRate           Int             @default(150)
  customRate            Boolean         @default(false)
  highSchoolGradYear    Int?
  highSchoolGraduated   Boolean?
  collegeGradYear       Int?
  postGradYear          Int?

  // Dugsi-Specific Fields
  gender                Gender?
  parentEmail           String?
  parentFirstName       String?
  parentLastName        String?
  familyReferenceId     String?

  // Stripe Integration (Separate per Program)
  stripeCustomerId      String?         // Mahad payments
  stripeCustomerIdDugsi String?         // Dugsi payments
  stripeSubscriptionId  String?         // Mahad subscription
  stripeSubscriptionIdDugsi String?     // Dugsi subscription
  subscriptionStatus    SubscriptionStatus?
  lastPaymentDate       Date?

  // Relations
  batchId               String?
  Batch                 Batch?          @relation(fields: [batchId])
  siblingId             String?
  Sibling               Sibling?        @relation(fields: [siblingId])
  AttendanceRecord      AttendanceRecord[]

  // Timestamps
  createdAt             Date            @default(now())
  updatedAt             Date            @updatedAt

  // Indexes
  @@index([email])
  @@index([name])
  @@index([batchId])
  @@index([subscriptionStatus])
  @@index([educationLevel])
  @@index([gradeLevel])
  @@index([program])  // Critical for isolation
}
```

### Batch (Cohort)

**Groups students** into cohorts for scheduling and management.

```prisma
model Batch {
  id                String              @id @default(cuid())
  name              String              @unique
  startDate         DateTime?
  endDate           DateTime?

  // Relations
  Student           Student[]
  AttendanceSession AttendanceSession[]

  // Timestamps
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
}
```

**Key Constraints:**

- `name` must be unique
- Can't delete if has students (enforced in actions)
- Student count calculated dynamically (excludes withdrawn)

### Sibling

**Links related students** (siblings/family members).

```prisma
model Sibling {
  id        String    @id @default(cuid())
  Student   Student[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

**Usage:**

- Max 15 students per group (enforced in UI)
- Used for family discounts
- Prevents accidental deletion of family members

---

## Enums

### Program

```prisma
enum Program {
  MAHAD_PROGRAM  // College program
  DUGSI_PROGRAM  // K-12 program
}
```

**Critical:** All queries MUST filter by program to prevent data leaks.

### StudentStatus

```typescript
enum StudentStatus {
  registered    // Registered but not enrolled
  enrolled      // Active student
  active        // Alias for enrolled
  on_leave      // Temporarily inactive
  withdrawn     // Permanently left
  suspended     // Disciplinary/administrative
  graduated     // Completed program
}
```

### SubscriptionStatus

```prisma
enum SubscriptionStatus {
  active
  past_due
  canceled
  unpaid
  trialing
  incomplete
  incomplete_expired
  paused
}
```

**Synced from Stripe** via webhooks.

### EducationLevel

```prisma
enum EducationLevel {
  ELEMENTARY
  MIDDLE_SCHOOL
  HIGH_SCHOOL
  SOME_COLLEGE
  ASSOCIATES
  BACHELORS
  MASTERS
  DOCTORATE
}
```

### GradeLevel

```prisma
enum GradeLevel {
  KINDERGARTEN
  GRADE_1 through GRADE_12
  COLLEGE_FRESHMAN
  COLLEGE_SOPHOMORE
  COLLEGE_JUNIOR
  COLLEGE_SENIOR
  GRADUATE
}
```

---

## Relationships Diagram

```
┌─────────────┐
│   Sibling   │
│   (Group)   │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────┐         ┌─────────────┐
│   Student   │ N:1     │    Batch    │
│             ├────────▶│   (Cohort)  │
│  program ✓  │         │             │
└──────┬──────┘         └──────┬──────┘
       │                       │
       │ 1:N                   │ 1:N
       ▼                       ▼
┌────────────────┐      ┌──────────────────┐
│ AttendanceRecord│      │ AttendanceSession│
└────────────────┘      └──────────────────┘
```

---

## Query Patterns

### Program Isolation

**Always include program filter:**

```typescript
// ✅ CORRECT
await prisma.student.findMany({
  where: {
    program: 'MAHAD_PROGRAM',
    status: 'enrolled',
  },
})

// ❌ WRONG - Can return dugsi students!
await prisma.student.findMany({
  where: { status: 'enrolled' },
})
```

### Batch Student Count

**Exclude withdrawn students:**

```typescript
await prisma.batch.findMany({
  include: {
    _count: {
      select: {
        Student: {
          where: {
            status: { not: 'withdrawn' },
          },
        },
      },
    },
  },
})
```

### Duplicate Detection

**Normalize phone before matching:**

```typescript
const normalizedPhone = phone.replace(/\D/g, '')

const duplicates = await prisma.student.groupBy({
  by: ['phone'],
  where: {
    program: 'MAHAD_PROGRAM',
    phone: { not: null },
  },
  _count: { id: true },
  having: { phone: { _count: { gt: 1 } } },
})
```

---

## Data Integrity Rules

### Unique Constraints

1. **Email**: Globally unique across ALL programs
2. **Phone**: Globally unique across ALL programs
3. **Batch name**: Unique

### Foreign Keys

- `Student.batchId` → `Batch.id` (optional, can be null)
- `Student.siblingId` → `Sibling.id` (optional, can be null)

### Cascade Behavior

- **Delete Batch**: Blocked if has students (enforced in app logic)
- **Delete Student**: Orphans sibling group if last member (acceptable)

---

## Stripe Integration

### Customer ID Separation

Each student can have TWO Stripe customers:

- `stripeCustomerId` - For Mahad payments ($150/month)
- `stripeCustomerIdDugsi` - For Dugsi payments ($150/month)

### Subscription Lifecycle

1. **Student registers** → `subscriptionStatus: null`
2. **Student subscribes in Stripe** → Webhook updates `stripeCustomerId` + `subscriptionStatus: 'active'`
3. **Payment succeeds** → Webhook updates `lastPaymentDate`
4. **Payment fails** → Webhook updates `subscriptionStatus: 'past_due'`
5. **Student cancels** → Webhook updates `subscriptionStatus: 'canceled'`

### Webhook Protection

**Tests verify** mahad webhooks can't update dugsi students and vice versa:

- `lib/__tests__/mahad-protection.test.ts`
- Validates program isolation in webhook handlers

---

## Migration History

**Key Migrations:**

- `20251117111149_add_filter_indexes` - Added indexes for filtering performance
- Earlier migrations created base schema

**Schema Version:** Managed by Prisma migrations

---

## Performance Stats

**Typical Query Times** (with indexes):

- Get batches: ~50ms
- Get students (filtered, 50 items): ~100-200ms
- Search by name: ~80ms
- Find duplicates: ~150ms

**Bottlenecks:**

- None identified in current scale
- Phone normalization happens in-app (could move to DB function)

---

## Security Considerations

### SQL Injection

✅ **Protected by Prisma** - All queries are parameterized

### Data Leakage

✅ **Protected by program filter** - Always filter by `program`

### XSS

✅ **Protected by React** - Auto-escapes rendered content

### CSRF

✅ **Protected by Next.js** - Server Actions use built-in CSRF protection

---

**Last Updated**: 2025-11-17
**Schema Version**: Latest (check `prisma/schema.prisma`)
