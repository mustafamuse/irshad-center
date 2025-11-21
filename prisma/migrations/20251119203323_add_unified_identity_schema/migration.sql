-- CreateEnum: ContactType
CREATE TYPE "public"."ContactType" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP', 'OTHER');

-- CreateEnum: ContactVerificationStatus
CREATE TYPE "public"."ContactVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'INVALID');

-- CreateEnum: GuardianRole
CREATE TYPE "public"."GuardianRole" AS ENUM ('PARENT', 'GUARDIAN', 'SPONSOR', 'DONOR');

-- CreateEnum: EnrollmentStatus
CREATE TYPE "public"."EnrollmentStatus" AS ENUM ('REGISTERED', 'ENROLLED', 'ON_LEAVE', 'WITHDRAWN', 'COMPLETED', 'SUSPENDED');

-- CreateTable: Person
CREATE TABLE "public"."Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ContactPoint
CREATE TABLE "public"."ContactPoint" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" "public"."ContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "public"."ContactVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GuardianRelationship
CREATE TABLE "public"."GuardianRelationship" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "dependentId" TEXT NOT NULL,
    "role" "public"."GuardianRole" NOT NULL DEFAULT 'PARENT',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProgramProfile
CREATE TABLE "public"."ProgramProfile" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "program" "public"."Program" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "monthlyRate" INTEGER NOT NULL DEFAULT 150,
    "customRate" BOOLEAN NOT NULL DEFAULT false,
    "legacyStudentId" TEXT,
    "gender" "public"."Gender",
    "educationLevel" "public"."EducationLevel",
    "gradeLevel" "public"."GradeLevel",
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
    "legacyParentEmail" TEXT,
    "legacyParentFirstName" TEXT,
    "legacyParentLastName" TEXT,
    "legacyParentPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Enrollment
CREATE TABLE "public"."Enrollment" (
    "id" TEXT NOT NULL,
    "programProfileId" TEXT NOT NULL,
    "batchId" TEXT,
    "status" "public"."EnrollmentStatus" NOT NULL DEFAULT 'REGISTERED',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BillingAccount
CREATE TABLE "public"."BillingAccount" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "accountType" "public"."StripeAccountType" NOT NULL,
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

-- CreateTable: Subscription
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "stripeAccountType" "public"."StripeAccountType" NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'incomplete',
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

-- CreateTable: BillingAssignment
CREATE TABLE "public"."BillingAssignment" (
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

-- CreateTable: SubscriptionHistory
CREATE TABLE "public"."SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL,
    "amount" INTEGER,
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Person indexes
CREATE INDEX "Person_name_idx" ON "public"."Person"("name");
CREATE INDEX "Person_createdAt_idx" ON "public"."Person"("createdAt");

-- CreateIndex: ContactPoint indexes
CREATE UNIQUE INDEX "ContactPoint_personId_type_value_key" ON "public"."ContactPoint"("personId", "type", "value");
CREATE INDEX "ContactPoint_personId_idx" ON "public"."ContactPoint"("personId");
CREATE INDEX "ContactPoint_value_idx" ON "public"."ContactPoint"("value");
CREATE INDEX "ContactPoint_type_value_idx" ON "public"."ContactPoint"("type", "value");

-- CreateIndex: GuardianRelationship indexes
CREATE UNIQUE INDEX "GuardianRelationship_guardianId_dependentId_role_key" ON "public"."GuardianRelationship"("guardianId", "dependentId", "role");
CREATE INDEX "GuardianRelationship_guardianId_idx" ON "public"."GuardianRelationship"("guardianId");
CREATE INDEX "GuardianRelationship_dependentId_idx" ON "public"."GuardianRelationship"("dependentId");
CREATE INDEX "GuardianRelationship_isActive_idx" ON "public"."GuardianRelationship"("isActive");

-- CreateIndex: ProgramProfile indexes
CREATE UNIQUE INDEX "ProgramProfile_legacyStudentId_key" ON "public"."ProgramProfile"("legacyStudentId");
CREATE UNIQUE INDEX "ProgramProfile_personId_program_key" ON "public"."ProgramProfile"("personId", "program");
CREATE INDEX "ProgramProfile_personId_idx" ON "public"."ProgramProfile"("personId");
CREATE INDEX "ProgramProfile_program_idx" ON "public"."ProgramProfile"("program");
CREATE INDEX "ProgramProfile_status_idx" ON "public"."ProgramProfile"("status");
CREATE INDEX "ProgramProfile_program_status_idx" ON "public"."ProgramProfile"("program", "status");

-- CreateIndex: Enrollment indexes
CREATE INDEX "Enrollment_programProfileId_idx" ON "public"."Enrollment"("programProfileId");
CREATE INDEX "Enrollment_batchId_idx" ON "public"."Enrollment"("batchId");
CREATE INDEX "Enrollment_status_idx" ON "public"."Enrollment"("status");
CREATE INDEX "Enrollment_startDate_idx" ON "public"."Enrollment"("startDate");
CREATE INDEX "Enrollment_programProfileId_status_idx" ON "public"."Enrollment"("programProfileId", "status");

-- CreateIndex: BillingAccount indexes
CREATE INDEX "BillingAccount_personId_idx" ON "public"."BillingAccount"("personId");
CREATE INDEX "BillingAccount_accountType_idx" ON "public"."BillingAccount"("accountType");
CREATE INDEX "BillingAccount_stripeCustomerIdMahad_idx" ON "public"."BillingAccount"("stripeCustomerIdMahad");
CREATE INDEX "BillingAccount_stripeCustomerIdDugsi_idx" ON "public"."BillingAccount"("stripeCustomerIdDugsi");

-- CreateIndex: Subscription indexes
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "public"."Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_billingAccountId_idx" ON "public"."Subscription"("billingAccountId");
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "public"."Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "public"."Subscription"("stripeCustomerId");
CREATE INDEX "Subscription_status_idx" ON "public"."Subscription"("status");
CREATE INDEX "Subscription_stripeAccountType_status_idx" ON "public"."Subscription"("stripeAccountType", "status");

-- CreateIndex: BillingAssignment indexes
CREATE INDEX "BillingAssignment_subscriptionId_idx" ON "public"."BillingAssignment"("subscriptionId");
CREATE INDEX "BillingAssignment_programProfileId_idx" ON "public"."BillingAssignment"("programProfileId");
CREATE INDEX "BillingAssignment_isActive_idx" ON "public"."BillingAssignment"("isActive");
CREATE INDEX "BillingAssignment_subscriptionId_programProfileId_idx" ON "public"."BillingAssignment"("subscriptionId", "programProfileId");

-- CreateIndex: SubscriptionHistory indexes
CREATE INDEX "SubscriptionHistory_subscriptionId_idx" ON "public"."SubscriptionHistory"("subscriptionId");
CREATE INDEX "SubscriptionHistory_eventType_idx" ON "public"."SubscriptionHistory"("eventType");
CREATE INDEX "SubscriptionHistory_processedAt_idx" ON "public"."SubscriptionHistory"("processedAt");

-- AddForeignKey: ContactPoint -> Person
ALTER TABLE "public"."ContactPoint" ADD CONSTRAINT "ContactPoint_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: GuardianRelationship -> Person (guardian)
ALTER TABLE "public"."GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "public"."Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: GuardianRelationship -> Person (dependent)
ALTER TABLE "public"."GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "public"."Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProgramProfile -> Person
ALTER TABLE "public"."ProgramProfile" ADD CONSTRAINT "ProgramProfile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Enrollment -> ProgramProfile
ALTER TABLE "public"."Enrollment" ADD CONSTRAINT "Enrollment_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "public"."ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Enrollment -> Batch
ALTER TABLE "public"."Enrollment" ADD CONSTRAINT "Enrollment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: BillingAccount -> Person
ALTER TABLE "public"."BillingAccount" ADD CONSTRAINT "BillingAccount_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: BillingAccount -> ContactPoint
ALTER TABLE "public"."BillingAccount" ADD CONSTRAINT "BillingAccount_primaryContactPointId_fkey" FOREIGN KEY ("primaryContactPointId") REFERENCES "public"."ContactPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Subscription -> BillingAccount
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "public"."BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BillingAssignment -> Subscription
ALTER TABLE "public"."BillingAssignment" ADD CONSTRAINT "BillingAssignment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BillingAssignment -> ProgramProfile
ALTER TABLE "public"."BillingAssignment" ADD CONSTRAINT "BillingAssignment_programProfileId_fkey" FOREIGN KEY ("programProfileId") REFERENCES "public"."ProgramProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SubscriptionHistory -> Subscription
ALTER TABLE "public"."SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

