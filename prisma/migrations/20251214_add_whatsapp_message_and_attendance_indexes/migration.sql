-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('TRANSACTIONAL', 'NOTIFICATION', 'REMINDER', 'ANNOUNCEMENT', 'MARKETING');

-- CreateEnum
CREATE TYPE "WhatsAppRecipientType" AS ENUM ('PARENT', 'STUDENT', 'TEACHER', 'STAFF');

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "waMessageId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "templateName" TEXT,
    "program" "Program",
    "recipientType" "WhatsAppRecipientType",
    "personId" TEXT,
    "familyId" TEXT,
    "batchId" TEXT,
    "messageType" "WhatsAppMessageType" NOT NULL DEFAULT 'TRANSACTIONAL',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_phoneNumber_idx" ON "WhatsAppMessage"("phoneNumber");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_waMessageId_idx" ON "WhatsAppMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_idx" ON "WhatsAppMessage"("status");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_program_idx" ON "WhatsAppMessage"("program");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_recipientType_idx" ON "WhatsAppMessage"("recipientType");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_messageType_idx" ON "WhatsAppMessage"("messageType");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_personId_idx" ON "WhatsAppMessage"("personId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_program_createdAt_idx" ON "WhatsAppMessage"("program", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update indexes for DugsiAttendanceSession
DROP INDEX IF EXISTS "DugsiAttendanceSession_teacherId_idx";
CREATE INDEX "DugsiAttendanceSession_teacherId_date_idx" ON "DugsiAttendanceSession"("teacherId", "date");

-- Update indexes for DugsiClassEnrollment
CREATE INDEX IF NOT EXISTS "DugsiClassEnrollment_classId_isActive_idx" ON "DugsiClassEnrollment"("classId", "isActive");
