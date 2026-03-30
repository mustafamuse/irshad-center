-- Step 1: Add nullable columns (no constraint yet)
ALTER TABLE "Person" ADD COLUMN "email" TEXT;
ALTER TABLE "Person" ADD COLUMN "phone" TEXT;

-- Step 2: Backfill emails (matches normalizeEmail: lowercase + trim)
UPDATE "Person" p
SET email = LOWER(TRIM(cp.value))
FROM "ContactPoint" cp
WHERE cp."personId" = p.id
  AND cp.type = 'EMAIL'
  AND cp."isActive" = true;

-- Step 3: Backfill phones (matches normalizePhone: US-only 10-digit)
UPDATE "Person" p
SET phone = CASE
  WHEN LENGTH(digits) = 11 AND digits LIKE '1%' THEN SUBSTRING(digits FROM 2)
  WHEN LENGTH(digits) = 10 THEN digits
  ELSE NULL
END
FROM (
  SELECT "personId", REGEXP_REPLACE(value, '\D', '', 'g') AS digits
  FROM "ContactPoint"
  WHERE type = 'PHONE' AND "isActive" = true
) cp
WHERE cp."personId" = p.id;

-- Step 4: Safety — ensure no empty strings (NULL not empty string rule)
UPDATE "Person" SET email = NULL WHERE email = '';
UPDATE "Person" SET phone = NULL WHERE phone = '';

-- Step 5: Add unique constraints
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");
CREATE UNIQUE INDEX "Person_phone_key" ON "Person"("phone");
