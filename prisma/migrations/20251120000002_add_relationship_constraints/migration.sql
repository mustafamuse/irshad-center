-- Add Relationship Constraints
-- These constraints enforce business rules at the database level

-- 1. Prevent guardian from being their own dependent
-- A person cannot be their own parent/guardian
ALTER TABLE "GuardianRelationship" 
ADD CONSTRAINT "check_no_self_guardian" 
CHECK ("guardianId" != "dependentId");

-- 2. Ensure sibling relationship ordering
-- This prevents duplicate relationships (A,B) and (B,A)
-- person1Id must always be less than person2Id
ALTER TABLE "SiblingRelationship"
ADD CONSTRAINT "check_person_ordering"
CHECK ("person1Id" < "person2Id");

-- 3. Add comment to explain the constraints
COMMENT ON CONSTRAINT "check_no_self_guardian" ON "GuardianRelationship" 
IS 'Prevents a person from being their own guardian - logical impossibility';

COMMENT ON CONSTRAINT "check_person_ordering" ON "SiblingRelationship" 
IS 'Ensures person1Id < person2Id to prevent duplicate sibling relationships';
