# ClassSchedule Explanation

## What is ClassSchedule?

**ClassSchedule** is the **class scheduling system** for Mahad (college program). It defines when and how classes are taught for each batch.

## Structure

```prisma
model ClassSchedule {
  id           String
  batchId      String        // Which batch (cohort) this schedule is for
  subjectId    String        // What subject (e.g., "Quran", "Arabic", "Fiqh")
  semesterId   String        // Which semester (e.g., "Fall 2024", "Spring 2025")
  daysOfWeek   DayOfWeek[]   // Which days (Monday, Wednesday, Friday, etc.)
  startTime    String        // Class start time (e.g., "09:00")
  endTime      String        // Class end time (e.g., "10:30")
  teacherId    String?       // Which teacher teaches this class
  isActive     Boolean       // Whether this schedule is currently active

  ClassSession ClassSession[] // Individual class sessions (actual class meetings)
}
```

## Example

A ClassSchedule might be:

- **Batch**: "Fall 2024 Cohort"
- **Subject**: "Quran"
- **Semester**: "Fall 2024"
- **Days**: Monday, Wednesday, Friday
- **Time**: 9:00 AM - 10:30 AM
- **Teacher**: "Ustadh Ahmed"

This creates a **recurring schedule** that says: "Every Monday, Wednesday, and Friday at 9 AM, the Fall 2024 Cohort has Quran class with Ustadh Ahmed."

## ClassSession vs ClassSchedule

### ClassSchedule (Template)

- **Recurring schedule** (every Monday/Wednesday/Friday)
- Defines the pattern
- Example: "Quran class every Mon/Wed/Fri at 9 AM"

### ClassSession (Individual Instance)

- **Specific class meeting** (one actual class)
- Created from ClassSchedule
- Example: "Quran class on Monday, October 15, 2024 at 9 AM"

**Relationship**: One ClassSchedule can have many ClassSessions (one for each actual class meeting).

## Why Mahad-Only?

**ClassSchedule links to Batch:**

```prisma
model ClassSchedule {
  batchId String  // Required - links to Batch
  Batch   Batch   @relation(...)
}
```

**Since Batch is Mahad-only:**

- Batch = Mahad cohorts only
- ClassSchedule → Batch = Mahad only
- Therefore: ClassSchedule is Mahad-only

**Dugsi doesn't use:**

- ❌ Batches (no cohorts)
- ❌ ClassSchedule (no batch-based scheduling)
- ❌ ClassSession (no scheduled class meetings)

## What Does Dugsi Use Instead?

Dugsi (K-12) likely uses:

- ✅ **Family-based grouping** (via `familyReferenceId`)
- ✅ **Age/grade-based grouping** (via `gradeLevel`)
- ✅ **Simple enrollment** (no batch assignment)

But **NOT**:

- ❌ Batch-based cohorts
- ❌ Subject-based class schedules
- ❌ Semester-based scheduling

## Current Status

**ClassSchedule is:**

- ✅ Used for Mahad class scheduling
- ✅ Links to Batch (Mahad-only)
- ✅ Has Subject, Semester, Teacher relationships
- ✅ Creates ClassSession instances

**Not used for:**

- ❌ Dugsi (no batches)
- ❌ Youth Events (no batches)
- ❌ Donations (no classes)

## Summary

**ClassSchedule** = The recurring class schedule template for Mahad batches

- Defines: What subject, when (days/time), which teacher, which semester
- Creates: Individual ClassSession instances for each actual class meeting
- Scope: Mahad-only (because it requires Batch, which is Mahad-only)
