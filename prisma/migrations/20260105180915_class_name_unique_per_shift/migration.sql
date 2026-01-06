-- Drop the existing unique constraint on name only
DROP INDEX IF EXISTS "DugsiClass_name_key";

-- Add new composite unique constraint on name + shift
CREATE UNIQUE INDEX "DugsiClass_name_shift_key" ON "DugsiClass"("name", "shift");
