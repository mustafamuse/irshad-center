-- RemoveArchiveTables
-- Drop ArchivedStudent and ArchivedBatch tables as legacy data retention is no longer needed

-- Drop ArchivedStudent first (has foreign key to ArchivedBatch)
DROP TABLE IF EXISTS "ArchivedStudent" CASCADE;

-- Drop ArchivedBatch
DROP TABLE IF EXISTS "ArchivedBatch" CASCADE;

