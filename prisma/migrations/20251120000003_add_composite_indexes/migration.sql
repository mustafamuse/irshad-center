-- Add Composite Indexes for Query Optimization
-- These indexes improve performance for common query patterns

-- ProgramProfile: Find all profiles for a person by program and status
CREATE INDEX IF NOT EXISTS "ProgramProfile_personId_program_status_idx" 
ON "ProgramProfile"("personId", "program", "status");

-- ProgramProfile: Program-specific lists sorted by creation date
CREATE INDEX IF NOT EXISTS "ProgramProfile_program_status_createdAt_idx" 
ON "ProgramProfile"("program", "status", "createdAt");

-- Enrollment: Find active enrollments (endDate is null for active)
CREATE INDEX IF NOT EXISTS "Enrollment_programProfileId_status_endDate_idx" 
ON "Enrollment"("programProfileId", "status", "endDate");

-- Enrollment: Batch enrollments by status and start date
CREATE INDEX IF NOT EXISTS "Enrollment_batchId_status_startDate_idx" 
ON "Enrollment"("batchId", "status", "startDate") WHERE "batchId" IS NOT NULL;

-- BillingAssignment: Calculate totals faster for validation
CREATE INDEX IF NOT EXISTS "BillingAssignment_subscriptionId_isActive_amount_idx" 
ON "BillingAssignment"("subscriptionId", "isActive", "amount");
