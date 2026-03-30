-- Phase 3: Drop ContactPoint table and related enums
-- Email and phone now live directly on Person as nullable unique fields.
-- ContactPoint was retained after Phase 2 (PR #181) for rollback safety.

-- Drop table first (CASCADE removes indexes, constraints, FK)
DROP TABLE "ContactPoint" CASCADE;

-- Drop enums (must come AFTER table drop — columns referenced them)
DROP TYPE "ContactType";
DROP TYPE "ContactVerificationStatus";
