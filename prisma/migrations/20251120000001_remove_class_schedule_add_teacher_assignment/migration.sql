-- Remove ClassSchedule System and Add TeacherAssignment for Dugsi
-- ClassSchedule/ClassSession were part of incomplete attendance feature
-- Each program will have different class and frequency schedules
-- Dugsi uses teacher assignments with shifts instead

-- Drop ClassSchedule-related tables
DROP TABLE IF EXISTS "ClassSession" CASCADE;
DROP TABLE IF EXISTS "ClassSchedule" CASCADE;
DROP TABLE IF EXISTS "Subject" CASCADE;
DROP TABLE IF EXISTS "Semester" CASCADE;

-- Drop DayOfWeek enum (only used by ClassSchedule)
DROP TYPE IF EXISTS "DayOfWeek" CASCADE;

-- Create Shift enum for Dugsi teacher assignments
CREATE TYPE "public"."Shift" AS ENUM ('MORNING', 'EVENING');

-- Create TeacherAssignment table for Dugsi
CREATE TABLE "public"."TeacherAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "shift" "public"."Shift" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- Create indexes for TeacherAssignment
CREATE UNIQUE INDEX "TeacherAssignment_teacherId_programProfileId_shift_key" ON "public"."TeacherAssignment"("teacherId", "programProfileId", "shift");
CREATE INDEX "TeacherAssignment_teacherId_idx" ON "public"."TeacherAssignment"("teacherId");
CREATE INDEX "TeacherAssignment_programProfileId_idx" ON "public"."TeacherAssignment"("programProfileId");
CREATE INDEX "TeacherAssignment_isActive_idx" ON "public"."TeacherAssignment"("isActive");
CREATE INDEX "TeacherAssignment_shift_idx" ON "public"."TeacherAssignment"("shift");

-- Add foreign keys
ALTER TABLE "public"."TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "public"."ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


