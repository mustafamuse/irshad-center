-- Phase 2: Teacher Attendance Status Lifecycle
-- Creates enums and tables for the full attendance status system:
--   TeacherAttendanceRecord  — one row per teacher/date/shift, tracks status lifecycle
--   DugsiAttendanceConfig    — singleton config for auto-mark window (minutes)
--   SchoolClosure            — admin-marked closed dates
--   ExcuseRequest            — teacher-submitted excuse requests

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE "TeacherAttendanceStatus" AS ENUM (
  'EXPECTED',
  'PRESENT',
  'LATE',
  'ABSENT',
  'EXCUSED',
  'CLOSED'
);

CREATE TYPE "AttendanceSource" AS ENUM (
  'SELF_CHECKIN',
  'ADMIN_OVERRIDE',
  'AUTO_MARKED',
  'SYSTEM'
);

CREATE TYPE "ExcuseRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- TeacherAttendanceRecord: living status record (DugsiTeacherCheckIn is the immutable fact log)
CREATE TABLE "TeacherAttendanceRecord" (
  "id"          TEXT NOT NULL,
  "teacherId"   TEXT NOT NULL,
  "date"        DATE NOT NULL,
  "shift"       "Shift" NOT NULL,
  "status"      "TeacherAttendanceStatus" NOT NULL DEFAULT 'EXPECTED',
  "source"      "AttendanceSource" NOT NULL DEFAULT 'SYSTEM',
  "checkInId"   TEXT,
  "clockInTime" TIMESTAMP(3),
  "minutesLate" INTEGER,
  "notes"       TEXT,
  "changedBy"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeacherAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- DugsiAttendanceConfig: singleton row — auto-seeded by getAttendanceConfig() on first read
CREATE TABLE "DugsiAttendanceConfig" (
  "id"                       TEXT NOT NULL DEFAULT 'singleton',
  "morningAutoMarkMinutes"   INTEGER NOT NULL DEFAULT 15,
  "afternoonAutoMarkMinutes" INTEGER NOT NULL DEFAULT 15,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  "updatedBy"                TEXT,

  CONSTRAINT "DugsiAttendanceConfig_pkey" PRIMARY KEY ("id")
);

-- SchoolClosure: admin-marked closed dates; propagates EXPECTED → CLOSED on insert
CREATE TABLE "SchoolClosure" (
  "id"        TEXT NOT NULL,
  "date"      DATE NOT NULL,
  "reason"    TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SchoolClosure_pkey" PRIMARY KEY ("id")
);

-- ExcuseRequest: teacher-submitted excuse requests for LATE / ABSENT records
CREATE TABLE "ExcuseRequest" (
  "id"                 TEXT NOT NULL,
  "attendanceRecordId" TEXT NOT NULL,
  "teacherId"          TEXT NOT NULL,
  "reason"             TEXT NOT NULL,
  "status"             "ExcuseRequestStatus" NOT NULL DEFAULT 'PENDING',
  "adminNote"          TEXT,
  "reviewedBy"         TEXT,
  "reviewedAt"         TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExcuseRequest_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

-- checkInId is a one-to-one FK back to DugsiTeacherCheckIn
CREATE UNIQUE INDEX "TeacherAttendanceRecord_checkInId_key"
  ON "TeacherAttendanceRecord"("checkInId");

-- Core business constraint: one status record per teacher/date/shift
CREATE UNIQUE INDEX "TeacherAttendanceRecord_teacherId_date_shift_key"
  ON "TeacherAttendanceRecord"("teacherId", "date", "shift");

-- One closure per calendar date
CREATE UNIQUE INDEX "SchoolClosure_date_key"
  ON "SchoolClosure"("date");

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

ALTER TABLE "TeacherAttendanceRecord"
  ADD CONSTRAINT "TeacherAttendanceRecord_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherAttendanceRecord"
  ADD CONSTRAINT "TeacherAttendanceRecord_checkInId_fkey"
  FOREIGN KEY ("checkInId") REFERENCES "DugsiTeacherCheckIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExcuseRequest"
  ADD CONSTRAINT "ExcuseRequest_attendanceRecordId_fkey"
  FOREIGN KEY ("attendanceRecordId") REFERENCES "TeacherAttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExcuseRequest"
  ADD CONSTRAINT "ExcuseRequest_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- INDEXES
-- Note: migration 20260410000000 creates TeacherAttendanceRecord_date_shift_status_idx
-- (replacing narrower date_shift and status_date indexes not created here).
-- DROP INDEX IF EXISTS statements in 20260410000001 and 20260410000002 are no-ops
-- for any index not created in this migration.
-- ============================================================================

-- Covers admin grid (date range) and auto-mark (date+shift+status=EXPECTED).
-- Created by the subsequent migration 20260410000000 — omitted here intentionally.

-- Covers getTeacherAttendanceSummary (teacherId + date range); teacherId prefix
-- also satisfies single-column teacherId lookups.
CREATE INDEX "TeacherAttendanceRecord_teacherId_date_idx"
  ON "TeacherAttendanceRecord"("teacherId", "date");

-- ExcuseRequest indexes
CREATE INDEX "ExcuseRequest_status_idx"
  ON "ExcuseRequest"("status");

CREATE INDEX "ExcuseRequest_attendanceRecordId_idx"
  ON "ExcuseRequest"("attendanceRecordId");

-- Covers getPendingExcuseRequests by teacher and teacherId prefix queries.
CREATE INDEX "ExcuseRequest_teacherId_status_idx"
  ON "ExcuseRequest"("teacherId", "status");
