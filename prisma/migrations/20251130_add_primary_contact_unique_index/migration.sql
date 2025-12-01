-- CreateIndex
-- Ensures only one primary contact per person per type
-- This is a partial index that only applies when isPrimary = true
CREATE UNIQUE INDEX "ContactPoint_one_primary_per_person_type"
ON "ContactPoint" ("personId", "type")
WHERE "isPrimary" = true;
