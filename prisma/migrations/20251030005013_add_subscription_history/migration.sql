-- Add subscription history tracking fields
-- These arrays store previous subscription IDs when students re-enroll or subscriptions change

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "previousSubscriptionIds" TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "previousSubscriptionIdsDugsi" TEXT[] DEFAULT '{}'::TEXT[];

