# ClassSchedule System Removal

## 🎯 Reason for Removal

ClassSchedule, ClassSession, Subject, and Semester were part of an **incomplete attendance feature**. Each program will have different class and frequency schedules, so we're removing this system to redesign it properly later.

## ✅ What Was Removed

### Models Removed:
1. **ClassSchedule** - Recurring class schedule templates
2. **ClassSession** - Individual class meeting instances
3. **Subject** - Subject/course definitions (e.g., "Quran", "Arabic")
4. **Semester** - Semester definitions (e.g., "Fall 2024")

### Enums Removed:
- **DayOfWeek** - Was only used by ClassSchedule

### Relations Removed:
- `Batch.ClassSchedule[]` - Batch no longer has class schedules
- `Teacher.ClassSchedule[]` - Teacher no longer linked to schedules

## 🔄 What Replaced It

### For Dugsi:
- ✅ **TeacherAssignment** - Links teachers to Dugsi students
- ✅ **Shift** enum - Morning/Evening shifts
- ✅ No batches, no class schedules

### For Mahad:
- ✅ **Batch** - Still exists (cohorts)
- ❌ No class schedules (removed)
- ❌ No teacher assignments (for now)

## 📋 Migration Steps

The migration will:
1. Drop ClassSchedule, ClassSession, Subject, Semester tables
2. Drop DayOfWeek enum
3. Create Shift enum (MORNING, EVENING)
4. Create TeacherAssignment table
5. Update Teacher model (remove ClassSchedule relation)

## ⚠️ Important Notes

- **No data migration needed** - Feature was incomplete
- **Teacher model kept** - Redesigned for Dugsi assignments
- **Batch model kept** - Still used by Mahad (just no class schedules)
- **Future redesign** - Class scheduling will be redesigned per program needs

## 🔮 Future Design

When ready to implement class scheduling:

**Mahad**:
- Batch-based scheduling
- Subject/course management
- Semester-based organization
- Teacher assignments per batch/subject

**Dugsi**:
- Teacher-based (already implemented)
- Shift-based (morning/evening)
- No batches
- Simpler structure

**Youth Events**:
- Event-based scheduling
- Session management
- Different from both Mahad and Dugsi

Each program will have its own optimized scheduling system.

