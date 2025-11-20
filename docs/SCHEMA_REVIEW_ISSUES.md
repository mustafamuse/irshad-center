# Database Schema Review - Issues & Redesign Recommendations

## 🔍 Comprehensive Review Summary

After reviewing all changes, here are the database design issues and areas that need work:

---

## ✅ **What's Good**

1. **Unified Identity Model** - Well-designed Person → ProgramProfile → Enrollment hierarchy
2. **Billing Model** - Flexible BillingAccount → Subscription → BillingAssignment structure
3. **Relationships** - GuardianRelationship and SiblingRelationship are properly designed
4. **Metadata Strategy** - JSONB metadata for program-specific fields is flexible
5. **Batch Constraint** - Properly documented as Mahad-only

---

## ⚠️ **Issues Found**

### 1. **Missing Database Constraints**

#### Issue: Enrollment.batchId Should Be Validated ✅ **DONE**
**Status**: ✅ **RESOLVED**

**Implementation**:
- ✅ Database CHECK constraint `check_dugsi_no_batch` added via migration `20251120000005_add_enrollment_batchid_constraint`
- ✅ Application-level validation in `lib/services/validation-service.ts`
- ✅ Schema documentation added

**Files Updated**:
- `prisma/migrations/20251120000005_add_enrollment_batchid_constraint/migration.sql`
- `lib/services/validation-service.ts`
- `prisma/schema.prisma`

#### Issue: BillingAccount.accountType vs Program Mismatch
**Problem**: `BillingAccount.accountType` (StripeAccountType) might not match the program being paid for

**Current State**:
```prisma
model BillingAccount {
  accountType StripeAccountType // MAHAD, DUGSI, YOUTH_EVENTS, GENERAL_DONATION
  stripeCustomerIdMahad String?
  stripeCustomerIdDugsi String?
  // ...
}
```

**Risk**: A billing account could have `accountType = MAHAD` but be used for Dugsi payments

**Recommendation**:
- Document that accountType is the PRIMARY account type
- Add validation when creating BillingAssignments
- Consider making accountType nullable or multi-type

#### Issue: ContactPoint Uniqueness
**Problem**: ContactPoint has `@@unique([personId, type, value])` but no global uniqueness

**Current State**:
```prisma
model ContactPoint {
  personId String
  type     ContactType
  value    String
  @@unique([personId, type, value])
}
```

**Question**: Should the same email/phone be allowed for multiple persons?
- ✅ **Current design allows it** (good for families sharing contacts)
- ⚠️ **But might cause matching issues** in billing matcher

**Recommendation**: Keep current design, but add index for global lookups:
```prisma
@@index([type, value]) // Already exists - good!
```

---

### 2. **Data Integrity Issues**

#### Issue: SiblingRelationship Ordering ✅ **DONE**
**Status**: ✅ **RESOLVED**

**Implementation**:
- ✅ Database CHECK constraint `check_person_ordering` added via migration `20251120000002_add_relationship_constraints`
- ✅ Schema comments added explaining the ordering requirement
- ✅ Application-level validation ensures person1Id < person2Id

**Files Updated**:
- `prisma/migrations/20251120000002_add_relationship_constraints/migration.sql`
- `prisma/schema.prisma` (comments added)

#### Issue: GuardianRelationship Self-Reference ✅ **DONE**
**Status**: ✅ **RESOLVED**

**Implementation**:
- ✅ Database CHECK constraint `check_no_self_guardian` added via migration `20251120000002_add_relationship_constraints`
- ✅ Application-level validation in `lib/services/validation-service.ts`
- ✅ Schema documentation added

**Files Updated**:
- `prisma/migrations/20251120000002_add_relationship_constraints/migration.sql`
- `lib/services/validation-service.ts`
- `prisma/schema.prisma` (documentation added)

#### Issue: ProgramProfile.legacy Fields
**Problem**: Legacy fields (`legacyStudentId`, `legacyParentEmail`, etc.) are kept for migration

**Current State**:
```prisma
model ProgramProfile {
  legacyStudentId String? @unique
  legacyParentEmail String?
  legacyParentFirstName String?
  legacyParentLastName String?
  legacyParentPhone String?
}
```

**Question**: When should these be removed?

**Recommendation**:
- Keep for now (migration period)
- Plan removal after full cutover
- Document deprecation timeline

---

### 3. **Missing Indexes**

#### Issue: Enrollment Program Filtering ✅ **DONE**
**Status**: ✅ **RESOLVED**

**Implementation**:
- ✅ `Enrollment`: `@@index([endDate])` added
- ✅ `Enrollment`: `@@index([programProfileId, status, endDate])` added
- ✅ `Enrollment`: `@@index([batchId, status, startDate])` added
- ✅ `ProgramProfile`: `@@index([program, status])` already exists
- ✅ `ProgramProfile`: `@@index([personId, program, status])` added
- ✅ `ProgramProfile`: `@@index([program, status, createdAt])` added

**Files Updated**:
- `prisma/schema.prisma`
- `prisma/migrations/20251120000003_add_composite_indexes/migration.sql`

#### Issue: BillingAssignment Active Filtering ✅ **DONE**
**Status**: ✅ **RESOLVED**

**Implementation**:
- ✅ `@@index([subscriptionId, isActive])` added
- ✅ `@@index([programProfileId, isActive])` added
- ✅ `@@index([subscriptionId, isActive, amount])` added

**Files Updated**:
- `prisma/schema.prisma`
- `prisma/migrations/20251120000003_add_composite_indexes/migration.sql`

---

### 4. **Architectural Concerns**

#### Issue: ClassSchedule/ClassSession - Mahad Only?
**Problem**: ClassSchedule and ClassSession are linked to Batch, but unclear if they're Mahad-only

**Current State**:
```prisma
model ClassSchedule {
  batchId String
  Batch Batch @relation(...)
}
```

**Question**: Are classes only for Mahad? Or does Dugsi have classes too?

**Recommendation**: 
- If Mahad-only: Document this clearly
- If Dugsi uses classes: Need different model (not batch-based)

#### Issue: ArchivedStudent References Student ✅ **RESOLVED**
**Problem**: ArchivedStudent still references `originalStudentId` which points to dropped Student table

**Status**: ✅ **RESOLVED** - Archive tables (`ArchivedBatch` and `ArchivedStudent`) have been removed
- Legacy data retention no longer needed
- Historical data can be preserved through other means if required
- Document that originalStudentId is now just a reference ID
- Consider linking to ProgramProfile.legacyStudentId instead

#### Issue: StudentPayment Naming
**Problem**: Model is called "StudentPayment" but now references ProgramProfile

**Current State**:
```prisma
model StudentPayment {
  programProfileId String
  ProgramProfile ProgramProfile @relation(...)
}
```

**Recommendation**: 
- Consider renaming to `ProgramPayment` or `PaymentRecord`
- Or keep name for backward compatibility (less ideal)

---

### 5. **Missing Validations**

#### Issue: Enrollment Status Transitions
**Problem**: No database constraint on valid status transitions

**Current State**:
```prisma
model Enrollment {
  status EnrollmentStatus @default(REGISTERED)
  // No constraint on transitions
}
```

**Valid Transitions**:
- REGISTERED → ENROLLED
- ENROLLED → ON_LEAVE, WITHDRAWN, COMPLETED, SUSPENDED
- ON_LEAVE → ENROLLED, WITHDRAWN
- etc.

**Recommendation**: Add application-level validation (enums can't enforce transitions)

#### Issue: BillingAssignment Amount Validation
**Problem**: No constraint ensuring assignment amounts don't exceed subscription amount

**Current State**:
```prisma
model BillingAssignment {
  subscriptionId String
  amount Int // Amount allocated
  percentage Float?
}
```

**Risk**: Total assignments could exceed subscription amount

**Recommendation**: Add application-level validation when creating assignments

---

### 6. **Redesign Recommendations**

#### Recommendation 1: Add Enrollment Program Constraint ✅ **DONE**
**Status**: ✅ **COMPLETED**
- ✅ Database CHECK constraint `check_dugsi_no_batch` added
- ✅ Application-level validation added

#### Recommendation 2: Clarify ClassSchedule Scope ✅ **DONE**
**Status**: ✅ **COMPLETED**
- ✅ Documented as Mahad-only in schema comments
- ✅ Batch is documented as Mahad-only

#### Recommendation 3: Add Composite Indexes ✅ **DONE**
**Status**: ✅ **COMPLETED**
- ✅ All critical composite indexes added:
  - `Enrollment`: `@@index([programProfileId, status, endDate])`
  - `Enrollment`: `@@index([batchId, status, startDate])`
  - `BillingAssignment`: `@@index([subscriptionId, isActive])`
  - `BillingAssignment`: `@@index([programProfileId, isActive])`
  - `BillingAssignment`: `@@index([subscriptionId, isActive, amount])`
  - `ProgramProfile`: `@@index([personId, program, status])`
  - `ProgramProfile`: `@@index([program, status, createdAt])`

#### Recommendation 4: Consider Renaming StudentPayment
**Action**: Rename to `PaymentRecord` or `ProgramPayment` for clarity

**Migration**: Create new model, migrate data, drop old model

---

## 📋 **Priority Actions**

### High Priority
1. ✅ Add application validation: Dugsi enrollments cannot have batchId (Database CHECK constraint + application validation)
2. ✅ Add application validation: GuardianRelationship guardianId !== dependentId (Database CHECK constraint + application validation)
3. ✅ Document ClassSchedule/ClassSession scope (Mahad-only?) (Schema comments added)
4. ✅ Add composite indexes for common queries (All critical indexes added)

### Medium Priority
5. ⚠️ Add BillingAssignment amount validation (Application-level only - still needed)
6. ✅ Document SiblingRelationship ordering requirement (Database CHECK constraint + schema comments)
7. ✅ Legacy fields removed (Migration complete - fields no longer needed)
8. ✅ Normalize ProgramProfile.status field (Migrated to EnrollmentStatus enum)
9. ✅ Add schema documentation (Inline comments throughout)
10. ✅ Document archive tables String ID format (Comments added)
11. ✅ Add metadata TypeScript types (Program-specific types added)

### Low Priority
8. 📝 Consider renaming StudentPayment
9. 📝 Add Enrollment status transition validation
10. 📝 Review ContactPoint uniqueness strategy

---

## 🎯 **Summary**

**Overall Assessment**: ✅ **Most issues resolved** - The schema is well-designed with good separation of concerns.

**Completed Actions**:
1. ✅ **Database constraints added** - CHECK constraints for Dugsi batchId, guardian self-reference, and sibling ordering
2. ✅ **Application-level validations** - Validation service updated with all critical validations
3. ✅ **Schema scope clarified** - ClassSchedule, Batch, and archive tables documented
4. ✅ **Composite indexes added** - All critical performance indexes added
5. ✅ **Status field normalized** - ProgramProfile.status migrated to EnrollmentStatus enum
6. ✅ **Schema documentation** - Inline comments added throughout
7. ✅ **Metadata types** - TypeScript types added for program-specific metadata
8. ✅ **Archive tables documented** - String ID format explained

**Remaining Actions**:
- ⚠️ Add BillingAssignment amount validation (Application-level only)
- ✅ Legacy fields removed (legacyStudentId, legacyParentEmail, etc.) - Migration complete
- 📝 Consider renaming StudentPayment (Future improvement)

The schema foundation is solid - most critical validations, optimizations, and documentation improvements are complete.

