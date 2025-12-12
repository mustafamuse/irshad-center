-- CreateEnum
CREATE TYPE "DugsiAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- AlterTable
ALTER TABLE "TeacherProgram" ADD COLUMN "shifts" "Shift"[];

-- CreateTable
CREATE TABLE "DugsiClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shift" "Shift" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DugsiClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DugsiClassEnrollment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DugsiClassEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DugsiAttendanceSession" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "notes" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DugsiAttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DugsiAttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "status" "DugsiAttendanceStatus" NOT NULL,
    "lessonCompleted" BOOLEAN NOT NULL DEFAULT false,
    "surahName" TEXT,
    "ayatFrom" INTEGER,
    "ayatTo" INTEGER,
    "lessonNotes" TEXT,
    "notes" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DugsiAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DugsiTeacherCheckIn" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" "Shift" NOT NULL,
    "clockInTime" TIMESTAMP(3) NOT NULL,
    "clockInLat" DOUBLE PRECISION,
    "clockInLng" DOUBLE PRECISION,
    "clockInValid" BOOLEAN NOT NULL,
    "clockOutTime" TIMESTAMP(3),
    "clockOutLat" DOUBLE PRECISION,
    "clockOutLng" DOUBLE PRECISION,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DugsiTeacherCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DugsiClass_name_key" ON "DugsiClass"("name");

-- CreateIndex
CREATE INDEX "DugsiClass_shift_idx" ON "DugsiClass"("shift");

-- CreateIndex
CREATE INDEX "DugsiClass_isActive_idx" ON "DugsiClass"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DugsiClassEnrollment_programProfileId_key" ON "DugsiClassEnrollment"("programProfileId");

-- CreateIndex
CREATE INDEX "DugsiClassEnrollment_classId_idx" ON "DugsiClassEnrollment"("classId");

-- CreateIndex
CREATE INDEX "DugsiClassEnrollment_isActive_idx" ON "DugsiClassEnrollment"("isActive");

-- CreateIndex
CREATE INDEX "DugsiAttendanceSession_date_idx" ON "DugsiAttendanceSession"("date");

-- CreateIndex
CREATE INDEX "DugsiAttendanceSession_classId_idx" ON "DugsiAttendanceSession"("classId");

-- CreateIndex
CREATE INDEX "DugsiAttendanceSession_teacherId_idx" ON "DugsiAttendanceSession"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "DugsiAttendanceSession_date_classId_key" ON "DugsiAttendanceSession"("date", "classId");

-- CreateIndex
CREATE INDEX "DugsiAttendanceRecord_sessionId_idx" ON "DugsiAttendanceRecord"("sessionId");

-- CreateIndex
CREATE INDEX "DugsiAttendanceRecord_programProfileId_idx" ON "DugsiAttendanceRecord"("programProfileId");

-- CreateIndex
CREATE INDEX "DugsiAttendanceRecord_status_idx" ON "DugsiAttendanceRecord"("status");

-- CreateIndex
CREATE INDEX "DugsiAttendanceRecord_programProfileId_status_idx" ON "DugsiAttendanceRecord"("programProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DugsiAttendanceRecord_sessionId_programProfileId_key" ON "DugsiAttendanceRecord"("sessionId", "programProfileId");

-- CreateIndex
CREATE INDEX "DugsiTeacherCheckIn_teacherId_idx" ON "DugsiTeacherCheckIn"("teacherId");

-- CreateIndex
CREATE INDEX "DugsiTeacherCheckIn_date_idx" ON "DugsiTeacherCheckIn"("date");

-- CreateIndex
CREATE INDEX "DugsiTeacherCheckIn_shift_idx" ON "DugsiTeacherCheckIn"("shift");

-- CreateIndex
CREATE UNIQUE INDEX "DugsiTeacherCheckIn_teacherId_date_shift_key" ON "DugsiTeacherCheckIn"("teacherId", "date", "shift");

-- AddForeignKey
ALTER TABLE "DugsiClassEnrollment" ADD CONSTRAINT "DugsiClassEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "DugsiClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DugsiClassEnrollment" ADD CONSTRAINT "DugsiClassEnrollment_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DugsiAttendanceSession" ADD CONSTRAINT "DugsiAttendanceSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "DugsiClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DugsiAttendanceSession" ADD CONSTRAINT "DugsiAttendanceSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DugsiAttendanceRecord" ADD CONSTRAINT "DugsiAttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DugsiAttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DugsiAttendanceRecord" ADD CONSTRAINT "DugsiAttendanceRecord_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DugsiTeacherCheckIn" ADD CONSTRAINT "DugsiTeacherCheckIn_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
