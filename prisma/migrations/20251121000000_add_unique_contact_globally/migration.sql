-- Add unique constraint globally on ContactPoint (type, value)
-- This enforces "one Person per human" by preventing the same email/phone
-- from existing across multiple Person records

-- First, rename the existing unique constraint to have a proper name
ALTER TABLE "ContactPoint" DROP CONSTRAINT IF EXISTS "ContactPoint_personId_type_value_key";
ALTER TABLE "ContactPoint" ADD CONSTRAINT "unique_contact_per_person" UNIQUE ("personId", "type", "value");

-- Add the new global unique constraint
-- This ensures the same email/phone cannot exist across different Person records
ALTER TABLE "ContactPoint" ADD CONSTRAINT "unique_contact_globally" UNIQUE ("type", "value");
