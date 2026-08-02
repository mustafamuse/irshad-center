-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('SELF_CHECKIN', 'ADMIN_OVERRIDE', 'AUTO_MARKED', 'SYSTEM', 'EXCUSE_APPROVED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('TEACHER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('PROGRAM_TERM', 'CLASS', 'CLASS_TERM', 'TEACHER_CLASS_ASSIGNMENT', 'STUDENT_CLASS_MEMBERSHIP', 'CLASS_SCHEDULE_RULE', 'CLASS_SCHEDULE_EXCEPTION', 'CLASS_SESSION', 'TEACHER_SESSION_ATTENDANCE', 'TEACHER_SESSION_VERIFICATION_ATTEMPT', 'STUDENT_SESSION_RECORD', 'STUDENT_SESSION_LEARNING_ENTRY', 'STUDENT_PROGRESS_SUMMARY', 'TERM_SNAPSHOT', 'SESSION_EDIT_LOCK', 'PROMOTION_EVENT');

-- CreateEnum
CREATE TYPE "ClassTermStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExcuseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LearningDomain" AS ENUM ('DAREERIS', 'CASHAR', 'HINGAAD', 'BEHAVIOR');

-- CreateEnum
CREATE TYPE "MahadAssessmentType" AS ENUM ('QUIZ', 'MIDTERM', 'FINAL', 'PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "MahadCohortEnrollmentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MahadCohortStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MahadCreditResultStatus" AS ENUM ('IN_PROGRESS', 'PASSED', 'FAILED', 'TRANSFERRED', 'WAIVED');

-- CreateEnum
CREATE TYPE "MahadProgramTermEnrollmentStatus" AS ENUM ('ENROLLED', 'ON_LEAVE', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProgramTermStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "StudentAttendanceStatus" AS ENUM ('UNMARKED', 'PRESENT', 'LATE', 'ABSENT');

-- CreateEnum
CREATE TYPE "TeacherAttendanceStatus" AS ENUM ('EXPECTED', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TeacherSessionAttendanceStatus" AS ENUM ('UNSTARTED', 'PRESENT', 'LATE', 'ABSENT');

-- CreateEnum
CREATE TYPE "TeacherVerificationMethod" AS ENUM ('GEOFENCE', 'SITE_PIN');

-- CreateEnum
CREATE TYPE "TeacherVerificationStatus" AS ENUM ('VERIFIED', 'FALLBACK_VERIFIED', 'UNVERIFIED_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "TermSnapshotStatus" AS ENUM ('CURRENT', 'STALE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('NOT_ASSIGNED', 'INCOMPLETE', 'COMPLETE');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "siteId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassScheduleException" (
    "id" TEXT NOT NULL,
    "classTermId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "overrideTeacherId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassScheduleRule" (
    "id" TEXT NOT NULL,
    "classTermId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "scheduledStartTime" TIME(6) NOT NULL,
    "scheduledEndTime" TIME(6) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassScheduleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "classTermId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "date" DATE NOT NULL,
    "scheduledStartTime" TIME(6) NOT NULL,
    "scheduledEndTime" TIME(6) NOT NULL,
    "primaryTeacherId" TEXT NOT NULL,
    "classNameSnapshot" TEXT NOT NULL,
    "teacherNameSnapshot" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTerm" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "status" "ClassTermStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DugsiAttendanceConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "morningAutoMarkMinutes" INTEGER NOT NULL DEFAULT 15,
    "afternoonAutoMarkMinutes" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "DugsiAttendanceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcuseRequest" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ExcuseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcuseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Level" (
    "id" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MahadAssessment" (
    "id" TEXT NOT NULL,
    "programTermDetailsId" TEXT NOT NULL,
    "classTermId" TEXT,
    "type" "MahadAssessmentType" NOT NULL,
    "name" TEXT NOT NULL,
    "maxPoints" DECIMAL(8,2) NOT NULL,
    "weight" DECIMAL(5,2),
    "scheduledOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MahadAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MahadAssessmentResult" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "score" DECIMAL(8,2),
    "passed" BOOLEAN,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MahadAssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MahadClassTermDetails" (
    "id" TEXT NOT NULL,
    "classTermId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "creditHours" DECIMAL(5,2) NOT NULL,
    "capacity" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MahadClassTermDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MahadCohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "programVersion" TEXT,
    "startsOn" DATE NOT NULL,
    "expectedGraduationOn" DATE,
    "status" "MahadCohortStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MahadCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MahadCohortEnrollment" (
    "id" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "status" "MahadCohortEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MahadCohortEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MahadCreditLedger" (
    "id" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "programTermDetailsId" TEXT NOT NULL,
    "classTermId" TEXT,
    "creditsAttempted" DECIMAL(5,2) NOT NULL,
    "creditsEarned" DECIMAL(5,2) NOT NULL,
    "resultStatus" "MahadCreditResultStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MahadCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MahadGraduationRequirement" (
    "id" TEXT NOT NULL,
    "programVersion" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requiredCredits" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MahadGraduationRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MahadProgramTermDetails" (
    "id" TEXT NOT NULL,
    "programTermId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "finalsStartOn" DATE,
    "finalsEndOn" DATE,
    "breakEndsOn" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MahadProgramTermDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MahadProgramTermEnrollment" (
    "id" TEXT NOT NULL,
    "cohortEnrollmentId" TEXT NOT NULL,
    "programTermDetailsId" TEXT NOT NULL,
    "status" "MahadProgramTermEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MahadProgramTermEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MahadSubject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "creditHours" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MahadSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTerm" (
    "id" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "status" "ProgramTermStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolClosure" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEditLock" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "heartbeatAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEditLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sitePinHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentClassMembership" (
    "id" TEXT NOT NULL,
    "classTermId" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentClassMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProgressSummary" (
    "id" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "domain" "LearningDomain" NOT NULL,
    "summary" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProgressSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSessionLearningEntry" (
    "id" TEXT NOT NULL,
    "studentSessionRecordId" TEXT NOT NULL,
    "domain" "LearningDomain" NOT NULL,
    "entryType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSessionLearningEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSessionRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "studentNameSnapshot" TEXT NOT NULL,
    "snapshotMetadata" JSONB,
    "attendanceStatus" "StudentAttendanceStatus" NOT NULL DEFAULT 'UNMARKED',
    "isExcused" BOOLEAN NOT NULL DEFAULT false,
    "excuseCategory" TEXT,
    "excuseNote" TEXT,
    "classworkStatus" "WorkStatus" NOT NULL DEFAULT 'NOT_ASSIGNED',
    "homeworkStatus" "WorkStatus" NOT NULL DEFAULT 'NOT_ASSIGNED',
    "teacherNote" TEXT,
    "adminNote" TEXT,
    "markedByActorType" "AuditActorType",
    "markedByActorId" TEXT,
    "markedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAttendanceRecord" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" "Shift" NOT NULL,
    "status" "TeacherAttendanceStatus" NOT NULL DEFAULT 'EXPECTED',
    "source" "AttendanceSource" NOT NULL DEFAULT 'SYSTEM',
    "checkInId" TEXT,
    "clockInTime" TIMESTAMP(3),
    "minutesLate" INTEGER,
    "notes" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "previousStatus" "TeacherAttendanceStatus",

    CONSTRAINT "TeacherAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherClassAssignment" (
    "id" TEXT NOT NULL,
    "classTermId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherClassAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "TeacherSessionAttendanceStatus" NOT NULL DEFAULT 'UNSTARTED',
    "checkedInAt" TIMESTAMP(3),
    "minutesLate" INTEGER,
    "verificationMethod" "TeacherVerificationMethod",
    "verificationStatus" "TeacherVerificationStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherSessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSessionVerificationAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "method" "TeacherVerificationMethod",
    "outcome" "TeacherVerificationStatus" NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "TeacherSessionVerificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermSnapshot" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TermSnapshotStatus" NOT NULL,
    "generatedBy" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "TermSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_actorType_actorId_createdAt_idx" ON "AuditLog"("actorType", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Class_levelId_idx" ON "Class"("levelId");

-- CreateIndex
CREATE INDEX "Class_program_isActive_idx" ON "Class"("program", "isActive");

-- CreateIndex
CREATE INDEX "Class_siteId_idx" ON "Class"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_id_program_key" ON "Class"("id", "program");

-- CreateIndex
CREATE INDEX "ClassScheduleException_classTermId_date_idx" ON "ClassScheduleException"("classTermId", "date");

-- CreateIndex
CREATE INDEX "ClassScheduleRule_classTermId_isActive_idx" ON "ClassScheduleRule"("classTermId", "isActive");

-- CreateIndex
CREATE INDEX "ClassScheduleRule_effectiveFrom_effectiveTo_idx" ON "ClassScheduleRule"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "ClassSession_classTermId_date_idx" ON "ClassSession"("classTermId", "date");

-- CreateIndex
CREATE INDEX "ClassSession_primaryTeacherId_date_idx" ON "ClassSession"("primaryTeacherId", "date");

-- CreateIndex
CREATE INDEX "ClassSession_status_date_idx" ON "ClassSession"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_classTermId_date_scheduledStartTime_key" ON "ClassSession"("classTermId", "date", "scheduledStartTime");

-- CreateIndex
CREATE INDEX "ClassTerm_termId_status_idx" ON "ClassTerm"("termId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTerm_classId_termId_key" ON "ClassTerm"("classId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTerm_id_program_key" ON "ClassTerm"("id", "program");

-- CreateIndex
CREATE INDEX "ExcuseRequest_attendanceRecordId_idx" ON "ExcuseRequest"("attendanceRecordId");

-- CreateIndex
CREATE INDEX "ExcuseRequest_status_idx" ON "ExcuseRequest"("status");

-- CreateIndex
CREATE INDEX "ExcuseRequest_teacherId_status_idx" ON "ExcuseRequest"("teacherId", "status");

-- CreateIndex
CREATE INDEX "Level_program_isActive_sortOrder_idx" ON "Level"("program", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Level_id_program_key" ON "Level"("id", "program");

-- CreateIndex
CREATE UNIQUE INDEX "Level_program_name_key" ON "Level"("program", "name");

-- CreateIndex
CREATE INDEX "MahadAssessment_classTermId_idx" ON "MahadAssessment"("classTermId");

-- CreateIndex
CREATE INDEX "MahadAssessment_programTermDetailsId_idx" ON "MahadAssessment"("programTermDetailsId");

-- CreateIndex
CREATE INDEX "MahadAssessmentResult_programProfileId_idx" ON "MahadAssessmentResult"("programProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "MahadAssessmentResult_assessmentId_programProfileId_key" ON "MahadAssessmentResult"("assessmentId", "programProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "MahadClassTermDetails_classTermId_key" ON "MahadClassTermDetails"("classTermId");

-- CreateIndex
CREATE INDEX "MahadClassTermDetails_subjectId_idx" ON "MahadClassTermDetails"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "MahadCohort_name_key" ON "MahadCohort"("name");

-- CreateIndex
CREATE INDEX "MahadCohort_startsOn_idx" ON "MahadCohort"("startsOn");

-- CreateIndex
CREATE INDEX "MahadCohort_status_idx" ON "MahadCohort"("status");

-- CreateIndex
CREATE INDEX "MahadCohortEnrollment_cohortId_idx" ON "MahadCohortEnrollment"("cohortId");

-- CreateIndex
CREATE INDEX "MahadCohortEnrollment_programProfileId_idx" ON "MahadCohortEnrollment"("programProfileId");

-- CreateIndex
CREATE INDEX "MahadCreditLedger_classTermId_idx" ON "MahadCreditLedger"("classTermId");

-- CreateIndex
CREATE INDEX "MahadCreditLedger_programProfileId_idx" ON "MahadCreditLedger"("programProfileId");

-- CreateIndex
CREATE INDEX "MahadCreditLedger_programTermDetailsId_idx" ON "MahadCreditLedger"("programTermDetailsId");

-- CreateIndex
CREATE INDEX "MahadCreditLedger_subjectId_idx" ON "MahadCreditLedger"("subjectId");

-- CreateIndex
CREATE INDEX "MahadGraduationRequirement_programVersion_idx" ON "MahadGraduationRequirement"("programVersion");

-- CreateIndex
CREATE UNIQUE INDEX "MahadProgramTermDetails_programTermId_key" ON "MahadProgramTermDetails"("programTermId");

-- CreateIndex
CREATE INDEX "MahadProgramTermDetails_cohortId_idx" ON "MahadProgramTermDetails"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "MahadProgramTermDetails_cohortId_sequence_key" ON "MahadProgramTermDetails"("cohortId", "sequence");

-- CreateIndex
CREATE INDEX "MahadProgramTermEnrollment_programTermDetailsId_idx" ON "MahadProgramTermEnrollment"("programTermDetailsId");

-- CreateIndex
CREATE UNIQUE INDEX "MahadProgramTermEnrollment_cohortEnrollmentId_programTermDe_key" ON "MahadProgramTermEnrollment"("cohortEnrollmentId", "programTermDetailsId");

-- CreateIndex
CREATE UNIQUE INDEX "MahadSubject_code_key" ON "MahadSubject"("code");

-- CreateIndex
CREATE INDEX "MahadSubject_isActive_idx" ON "MahadSubject"("isActive");

-- CreateIndex
CREATE INDEX "ProgramTerm_program_status_idx" ON "ProgramTerm"("program", "status");

-- CreateIndex
CREATE INDEX "ProgramTerm_startsOn_endsOn_idx" ON "ProgramTerm"("startsOn", "endsOn");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTerm_id_program_key" ON "ProgramTerm"("id", "program");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTerm_program_name_key" ON "ProgramTerm"("program", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClosure_date_key" ON "SchoolClosure"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEditLock_sessionId_key" ON "SessionEditLock"("sessionId");

-- CreateIndex
CREATE INDEX "SessionEditLock_actorType_actorId_idx" ON "SessionEditLock"("actorType", "actorId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE INDEX "Site_isActive_idx" ON "Site"("isActive");

-- CreateIndex
CREATE INDEX "StudentClassMembership_classTermId_effectiveFrom_effectiveT_idx" ON "StudentClassMembership"("classTermId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "StudentClassMembership_programProfileId_effectiveFrom_effec_idx" ON "StudentClassMembership"("programProfileId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "StudentProgressSummary_program_domain_idx" ON "StudentProgressSummary"("program", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProgressSummary_programProfileId_domain_key" ON "StudentProgressSummary"("programProfileId", "domain");

-- CreateIndex
CREATE INDEX "StudentSessionLearningEntry_domain_entryType_idx" ON "StudentSessionLearningEntry"("domain", "entryType");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSessionLearningEntry_studentSessionRecordId_domain_key" ON "StudentSessionLearningEntry"("studentSessionRecordId", "domain");

-- CreateIndex
CREATE INDEX "StudentSessionRecord_programProfileId_attendanceStatus_idx" ON "StudentSessionRecord"("programProfileId", "attendanceStatus");

-- CreateIndex
CREATE INDEX "StudentSessionRecord_sessionId_attendanceStatus_idx" ON "StudentSessionRecord"("sessionId", "attendanceStatus");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSessionRecord_sessionId_programProfileId_key" ON "StudentSessionRecord"("sessionId", "programProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAttendanceRecord_checkInId_key" ON "TeacherAttendanceRecord"("checkInId");

-- CreateIndex
CREATE INDEX "TeacherAttendanceRecord_date_shift_status_idx" ON "TeacherAttendanceRecord"("date", "shift", "status");

-- CreateIndex
CREATE INDEX "TeacherAttendanceRecord_teacherId_date_idx" ON "TeacherAttendanceRecord"("teacherId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAttendanceRecord_teacherId_date_shift_key" ON "TeacherAttendanceRecord"("teacherId", "date", "shift");

-- CreateIndex
CREATE INDEX "TeacherClassAssignment_classTermId_effectiveFrom_effectiveT_idx" ON "TeacherClassAssignment"("classTermId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "TeacherClassAssignment_teacherId_effectiveFrom_effectiveTo_idx" ON "TeacherClassAssignment"("teacherId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSessionAttendance_sessionId_key" ON "TeacherSessionAttendance"("sessionId");

-- CreateIndex
CREATE INDEX "TeacherSessionAttendance_checkedInAt_idx" ON "TeacherSessionAttendance"("checkedInAt");

-- CreateIndex
CREATE INDEX "TeacherSessionAttendance_status_idx" ON "TeacherSessionAttendance"("status");

-- CreateIndex
CREATE INDEX "TeacherSessionVerificationAttempt_outcome_attemptedAt_idx" ON "TeacherSessionVerificationAttempt"("outcome", "attemptedAt");

-- CreateIndex
CREATE INDEX "TeacherSessionVerificationAttempt_sessionId_attemptedAt_idx" ON "TeacherSessionVerificationAttempt"("sessionId", "attemptedAt");

-- CreateIndex
CREATE INDEX "TermSnapshot_termId_status_idx" ON "TermSnapshot"("termId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TermSnapshot_termId_version_key" ON "TermSnapshot"("termId", "version");

-- CreateIndex
CREATE INDEX "DugsiAttendanceSession_classId_date_idx" ON "DugsiAttendanceSession"("classId", "date" DESC);

-- CreateIndex
CREATE INDEX "DugsiAttendanceRecord_sessionId_status_idx" ON "DugsiAttendanceRecord"("sessionId", "status");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_levelId_program_fkey" FOREIGN KEY ("levelId", "program") REFERENCES "Level"("id", "program") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassScheduleException" ADD CONSTRAINT "ClassScheduleException_classTermId_program_fkey" FOREIGN KEY ("classTermId", "program") REFERENCES "ClassTerm"("id", "program") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassScheduleException" ADD CONSTRAINT "ClassScheduleException_overrideTeacherId_fkey" FOREIGN KEY ("overrideTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassScheduleRule" ADD CONSTRAINT "ClassScheduleRule_classTermId_program_fkey" FOREIGN KEY ("classTermId", "program") REFERENCES "ClassTerm"("id", "program") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_classTermId_program_fkey" FOREIGN KEY ("classTermId", "program") REFERENCES "ClassTerm"("id", "program") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_primaryTeacherId_fkey" FOREIGN KEY ("primaryTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTerm" ADD CONSTRAINT "ClassTerm_classId_program_fkey" FOREIGN KEY ("classId", "program") REFERENCES "Class"("id", "program") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTerm" ADD CONSTRAINT "ClassTerm_termId_program_fkey" FOREIGN KEY ("termId", "program") REFERENCES "ProgramTerm"("id", "program") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcuseRequest" ADD CONSTRAINT "ExcuseRequest_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "TeacherAttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcuseRequest" ADD CONSTRAINT "ExcuseRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadAssessment" ADD CONSTRAINT "MahadAssessment_classTermId_fkey" FOREIGN KEY ("classTermId") REFERENCES "ClassTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadAssessment" ADD CONSTRAINT "MahadAssessment_programTermDetailsId_fkey" FOREIGN KEY ("programTermDetailsId") REFERENCES "MahadProgramTermDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadAssessmentResult" ADD CONSTRAINT "MahadAssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "MahadAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadAssessmentResult" ADD CONSTRAINT "MahadAssessmentResult_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadClassTermDetails" ADD CONSTRAINT "MahadClassTermDetails_classTermId_fkey" FOREIGN KEY ("classTermId") REFERENCES "ClassTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadClassTermDetails" ADD CONSTRAINT "MahadClassTermDetails_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "MahadSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadCohortEnrollment" ADD CONSTRAINT "MahadCohortEnrollment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "MahadCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadCohortEnrollment" ADD CONSTRAINT "MahadCohortEnrollment_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadCreditLedger" ADD CONSTRAINT "MahadCreditLedger_classTermId_fkey" FOREIGN KEY ("classTermId") REFERENCES "ClassTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadCreditLedger" ADD CONSTRAINT "MahadCreditLedger_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadCreditLedger" ADD CONSTRAINT "MahadCreditLedger_programTermDetailsId_fkey" FOREIGN KEY ("programTermDetailsId") REFERENCES "MahadProgramTermDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadCreditLedger" ADD CONSTRAINT "MahadCreditLedger_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "MahadSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadProgramTermDetails" ADD CONSTRAINT "MahadProgramTermDetails_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "MahadCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadProgramTermDetails" ADD CONSTRAINT "MahadProgramTermDetails_programTermId_fkey" FOREIGN KEY ("programTermId") REFERENCES "ProgramTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadProgramTermEnrollment" ADD CONSTRAINT "MahadProgramTermEnrollment_cohortEnrollmentId_fkey" FOREIGN KEY ("cohortEnrollmentId") REFERENCES "MahadCohortEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MahadProgramTermEnrollment" ADD CONSTRAINT "MahadProgramTermEnrollment_programTermDetailsId_fkey" FOREIGN KEY ("programTermDetailsId") REFERENCES "MahadProgramTermDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEditLock" ADD CONSTRAINT "SessionEditLock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClassMembership" ADD CONSTRAINT "StudentClassMembership_classTermId_program_fkey" FOREIGN KEY ("classTermId", "program") REFERENCES "ClassTerm"("id", "program") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClassMembership" ADD CONSTRAINT "StudentClassMembership_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgressSummary" ADD CONSTRAINT "StudentProgressSummary_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSessionLearningEntry" ADD CONSTRAINT "StudentSessionLearningEntry_studentSessionRecordId_fkey" FOREIGN KEY ("studentSessionRecordId") REFERENCES "StudentSessionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSessionRecord" ADD CONSTRAINT "StudentSessionRecord_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSessionRecord" ADD CONSTRAINT "StudentSessionRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAttendanceRecord" ADD CONSTRAINT "TeacherAttendanceRecord_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "DugsiTeacherCheckIn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAttendanceRecord" ADD CONSTRAINT "TeacherAttendanceRecord_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherClassAssignment" ADD CONSTRAINT "TeacherClassAssignment_classTermId_program_fkey" FOREIGN KEY ("classTermId", "program") REFERENCES "ClassTerm"("id", "program") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherClassAssignment" ADD CONSTRAINT "TeacherClassAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSessionAttendance" ADD CONSTRAINT "TeacherSessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSessionVerificationAttempt" ADD CONSTRAINT "TeacherSessionVerificationAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermSnapshot" ADD CONSTRAINT "TermSnapshot_termId_fkey" FOREIGN KEY ("termId") REFERENCES "ProgramTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

