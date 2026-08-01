-- Step 1: Add nullable columns (no constraint yet)
ALTER TABLE "Person" ADD COLUMN "email" TEXT;
ALTER TABLE "Person" ADD COLUMN "phone" TEXT;

-- Step 2: Backfill emails (matches normalizeEmail: lowercase + trim)
UPDATE "Person" p
SET email = LOWER(TRIM(cp.value))
FROM (
  SELECT DISTINCT ON ("personId") "personId", value
  FROM "ContactPoint"
  WHERE type = 'EMAIL' AND "isActive" = true
  ORDER BY "personId", "isPrimary" DESC, "createdAt" DESC
) cp
WHERE cp."personId" = p.id;

-- Step 3: Backfill phones (matches normalizePhone: US-only 10-digit)
UPDATE "Person" p
SET phone = CASE
  WHEN LENGTH(digits) = 11 AND digits LIKE '1%' THEN SUBSTRING(digits FROM 2)
  WHEN LENGTH(digits) = 10 THEN digits
  ELSE NULL
END
FROM (
  SELECT DISTINCT ON ("personId") "personId", REGEXP_REPLACE(value, '\D', '', 'g') AS digits
  FROM "ContactPoint"
  WHERE type = 'PHONE' AND "isActive" = true
  ORDER BY "personId", "isPrimary" DESC, "createdAt" DESC
) cp
WHERE cp."personId" = p.id;

-- Step 4: Safety — ensure no empty strings (NULL not empty string rule)
UPDATE "Person" SET email = NULL WHERE email = '';
UPDATE "Person" SET phone = NULL WHERE phone = '';

-- Step 4.5: Pre-flight assertion — abort if duplicates would violate unique constraints
DO $$
BEGIN
  IF EXISTS (
    SELECT email FROM "Person" WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate emails found in Person table — resolve before adding unique constraint';
  END IF;
  IF EXISTS (
    SELECT phone FROM "Person" WHERE phone IS NOT NULL GROUP BY phone HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate phones found in Person table — resolve before adding unique constraint';
  END IF;
END $$;

-- Step 5: Add unique constraints
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");
CREATE UNIQUE INDEX "Person_phone_key" ON "Person"("phone");
