-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'EVENING');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('HIGH_SCHOOL', 'COLLEGE', 'POST_GRAD', 'ELEMENTARY', 'MIDDLE_SCHOOL');

-- CreateEnum
CREATE TYPE "GradeLevel" AS ENUM ('FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR', 'KINDERGARTEN', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9', 'GRADE_10', 'GRADE_11', 'GRADE_12');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');

-- CreateEnum
CREATE TYPE "Program" AS ENUM ('MAHAD_PROGRAM', 'DUGSI_PROGRAM', 'YOUTH_EVENTS', 'GENERAL_DONATION');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "StripeAccountType" AS ENUM ('MAHAD', 'DUGSI', 'YOUTH_EVENTS', 'GENERAL_DONATION');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'INVALID');

-- CreateEnum
CREATE TYPE "GuardianRole" AS ENUM ('PARENT', 'GUARDIAN', 'SPONSOR', 'DONOR');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('REGISTERED', 'ENROLLED', 'ON_LEAVE', 'WITHDRAWN', 'COMPLETED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPayment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "programProfileId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(6) NOT NULL,
    "stripeInvoiceId" TEXT,

    CONSTRAINT "StudentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "shift" "Shift" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPoint" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "ContactVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianRelationship" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "dependentId" TEXT NOT NULL,
    "role" "GuardianRole" NOT NULL DEFAULT 'PARENT',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiblingRelationship" (
    "id" TEXT NOT NULL,
    "person1Id" TEXT NOT NULL,
    "person2Id" TEXT NOT NULL,
    "detectionMethod" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiblingRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramProfile" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'REGISTERED',
    "monthlyRate" INTEGER NOT NULL DEFAULT 150,
    "customRate" BOOLEAN NOT NULL DEFAULT false,
    "gender" "Gender",
    "educationLevel" "EducationLevel",
    "gradeLevel" "GradeLevel",
    "schoolName" TEXT,
    "highSchoolGradYear" INTEGER,
    "highSchoolGraduated" BOOLEAN,
    "collegeGradYear" INTEGER,
    "collegeGraduated" BOOLEAN,
    "postGradYear" INTEGER,
    "postGradCompleted" BOOLEAN,
    "healthInfo" TEXT,
    "familyReferenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "batchId" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'REGISTERED',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "accountType" "StripeAccountType" NOT NULL,
    "stripeCustomerIdMahad" TEXT,
    "stripeCustomerIdDugsi" TEXT,
    "stripeCustomerIdYouth" TEXT,
    "stripeCustomerIdDonation" TEXT,
    "paymentIntentIdDugsi" TEXT,
    "paymentMethodCaptured" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethodCapturedAt" TIMESTAMP(3),
    "primaryContactPointId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "stripeAccountType" "StripeAccountType" NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'incomplete',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "paidUntil" TIMESTAMP(3),
    "lastPaymentDate" TIMESTAMP(3),
    "previousSubscriptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAssignment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "amount" INTEGER,
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Batch_name_key" ON "Batch"("name");

-- CreateIndex
CREATE INDEX "Batch_createdAt_idx" ON "Batch"("createdAt");

-- CreateIndex
CREATE INDEX "Batch_endDate_idx" ON "Batch"("endDate");

-- CreateIndex
CREATE INDEX "Batch_startDate_idx" ON "Batch"("startDate");

-- CreateIndex
CREATE INDEX "StudentPayment_programProfileId_year_month_idx" ON "StudentPayment"("programProfileId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPayment_programProfileId_stripeInvoiceId_key" ON "StudentPayment"("programProfileId", "stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_personId_key" ON "Teacher"("personId");

-- CreateIndex
CREATE INDEX "Teacher_personId_idx" ON "Teacher"("personId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_teacherId_idx" ON "TeacherAssignment"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_programProfileId_idx" ON "TeacherAssignment"("programProfileId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_isActive_idx" ON "TeacherAssignment"("isActive");

-- CreateIndex
CREATE INDEX "TeacherAssignment_shift_idx" ON "TeacherAssignment"("shift");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAssignment_teacherId_programProfileId_shift_key" ON "TeacherAssignment"("teacherId", "programProfileId", "shift");

-- CreateIndex
CREATE INDEX "Person_name_idx" ON "Person"("name");

-- CreateIndex
CREATE INDEX "Person_createdAt_idx" ON "Person"("createdAt");

-- CreateIndex
CREATE INDEX "ContactPoint_personId_idx" ON "ContactPoint"("personId");

-- CreateIndex
CREATE INDEX "ContactPoint_personId_isPrimary_idx" ON "ContactPoint"("personId", "isPrimary");

-- CreateIndex
CREATE INDEX "ContactPoint_value_idx" ON "ContactPoint"("value");

-- CreateIndex
CREATE INDEX "ContactPoint_type_value_idx" ON "ContactPoint"("type", "value");

-- CreateIndex
CREATE INDEX "ContactPoint_isActive_idx" ON "ContactPoint"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ContactPoint_type_value_isActive_key" ON "ContactPoint"("type", "value", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ContactPoint_personId_type_value_key" ON "ContactPoint"("personId", "type", "value");

-- CreateIndex
CREATE INDEX "GuardianRelationship_guardianId_idx" ON "GuardianRelationship"("guardianId");

-- CreateIndex
CREATE INDEX "GuardianRelationship_dependentId_idx" ON "GuardianRelationship"("dependentId");

-- CreateIndex
CREATE INDEX "GuardianRelationship_isActive_idx" ON "GuardianRelationship"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianRelationship_guardianId_dependentId_role_key" ON "GuardianRelationship"("guardianId", "dependentId", "role");

-- CreateIndex
CREATE INDEX "SiblingRelationship_person1Id_idx" ON "SiblingRelationship"("person1Id");

-- CreateIndex
CREATE INDEX "SiblingRelationship_person2Id_idx" ON "SiblingRelationship"("person2Id");

-- CreateIndex
CREATE INDEX "SiblingRelationship_isActive_idx" ON "SiblingRelationship"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SiblingRelationship_person1Id_person2Id_key" ON "SiblingRelationship"("person1Id", "person2Id");

-- CreateIndex
CREATE INDEX "ProgramProfile_personId_idx" ON "ProgramProfile"("personId");

-- CreateIndex
CREATE INDEX "ProgramProfile_program_idx" ON "ProgramProfile"("program");

-- CreateIndex
CREATE INDEX "ProgramProfile_status_idx" ON "ProgramProfile"("status");

-- CreateIndex
CREATE INDEX "ProgramProfile_program_status_idx" ON "ProgramProfile"("program", "status");

-- CreateIndex
CREATE INDEX "ProgramProfile_personId_program_status_idx" ON "ProgramProfile"("personId", "program", "status");

-- CreateIndex
CREATE INDEX "ProgramProfile_program_status_createdAt_idx" ON "ProgramProfile"("program", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramProfile_personId_program_key" ON "ProgramProfile"("personId", "program");

-- CreateIndex
CREATE INDEX "Enrollment_programProfileId_idx" ON "Enrollment"("programProfileId");

-- CreateIndex
CREATE INDEX "Enrollment_batchId_idx" ON "Enrollment"("batchId");

-- CreateIndex
CREATE INDEX "Enrollment_status_idx" ON "Enrollment"("status");

-- CreateIndex
CREATE INDEX "Enrollment_startDate_idx" ON "Enrollment"("startDate");

-- CreateIndex
CREATE INDEX "Enrollment_endDate_idx" ON "Enrollment"("endDate");

-- CreateIndex
CREATE INDEX "Enrollment_programProfileId_status_idx" ON "Enrollment"("programProfileId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_programProfileId_status_endDate_idx" ON "Enrollment"("programProfileId", "status", "endDate");

-- CreateIndex
CREATE INDEX "Enrollment_batchId_status_startDate_idx" ON "Enrollment"("batchId", "status", "startDate");

-- CreateIndex
CREATE INDEX "BillingAccount_personId_idx" ON "BillingAccount"("personId");

-- CreateIndex
CREATE INDEX "BillingAccount_accountType_idx" ON "BillingAccount"("accountType");

-- CreateIndex
CREATE INDEX "BillingAccount_stripeCustomerIdMahad_idx" ON "BillingAccount"("stripeCustomerIdMahad");

-- CreateIndex
CREATE INDEX "BillingAccount_stripeCustomerIdDugsi_idx" ON "BillingAccount"("stripeCustomerIdDugsi");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_billingAccountId_idx" ON "Subscription"("billingAccountId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_stripeAccountType_status_idx" ON "Subscription"("stripeAccountType", "status");

-- CreateIndex
CREATE INDEX "BillingAssignment_subscriptionId_idx" ON "BillingAssignment"("subscriptionId");

-- CreateIndex
CREATE INDEX "BillingAssignment_programProfileId_idx" ON "BillingAssignment"("programProfileId");

-- CreateIndex
CREATE INDEX "BillingAssignment_isActive_idx" ON "BillingAssignment"("isActive");

-- CreateIndex
CREATE INDEX "BillingAssignment_subscriptionId_programProfileId_idx" ON "BillingAssignment"("subscriptionId", "programProfileId");

-- CreateIndex
CREATE INDEX "BillingAssignment_subscriptionId_isActive_idx" ON "BillingAssignment"("subscriptionId", "isActive");

-- CreateIndex
CREATE INDEX "BillingAssignment_programProfileId_isActive_idx" ON "BillingAssignment"("programProfileId", "isActive");

-- CreateIndex
CREATE INDEX "BillingAssignment_subscriptionId_isActive_amount_idx" ON "BillingAssignment"("subscriptionId", "isActive", "amount");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_subscriptionId_idx" ON "SubscriptionHistory"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_eventType_idx" ON "SubscriptionHistory"("eventType");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_processedAt_idx" ON "SubscriptionHistory"("processedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_processedAt_idx" ON "WebhookEvent"("processedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_source_key" ON "WebhookEvent"("eventId", "source");

-- AddForeignKey
ALTER TABLE "StudentPayment" ADD CONSTRAINT "StudentPayment_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPoint" ADD CONSTRAINT "ContactPoint_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiblingRelationship" ADD CONSTRAINT "SiblingRelationship_person1Id_fkey" FOREIGN KEY ("person1Id") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiblingRelationship" ADD CONSTRAINT "SiblingRelationship_person2Id_fkey" FOREIGN KEY ("person2Id") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramProfile" ADD CONSTRAINT "ProgramProfile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_primaryContactPointId_fkey" FOREIGN KEY ("primaryContactPointId") REFERENCES "ContactPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAssignment" ADD CONSTRAINT "BillingAssignment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAssignment" ADD CONSTRAINT "BillingAssignment_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

