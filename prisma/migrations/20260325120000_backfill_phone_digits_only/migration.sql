-- Step 1: Deactivate older same-person duplicate contacts that would collide
-- after normalization. Tuple comparison (updatedAt, id) breaks ties when
-- timestamps are identical (bulk inserts, same transaction).
UPDATE "ContactPoint" cp
SET "isActive" = false,
    "deactivatedAt" = NOW()
WHERE cp."type" IN ('PHONE', 'WHATSAPP')
  AND cp."isActive" = true
  AND EXISTS (
    SELECT 1 FROM "ContactPoint" other
    WHERE other."personId" = cp."personId"
      AND other."type" = cp."type"
      AND other."isActive" = true
      AND other.id != cp.id
      AND regexp_replace(other."value", '\D', '', 'g') = regexp_replace(cp."value", '\D', '', 'g')
      AND (other."updatedAt", other.id) > (cp."updatedAt", cp.id)
  );

-- Step 1b: Deactivate older cross-person duplicates. The unique_active_contact_globally
-- constraint allows only one active contact per (type, value), so normalizing two
-- different-person contacts to the same digits would violate it.
UPDATE "ContactPoint" cp
SET "isActive" = false,
    "deactivatedAt" = NOW()
WHERE cp."type" IN ('PHONE', 'WHATSAPP')
  AND cp."isActive" = true
  AND EXISTS (
    SELECT 1 FROM "ContactPoint" other
    WHERE other."type" = cp."type"
      AND other."isActive" = true
      AND other.id != cp.id
      AND other."personId" != cp."personId"
      AND regexp_replace(other."value", '\D', '', 'g') = regexp_replace(cp."value", '\D', '', 'g')
      AND (other."updatedAt", other.id) > (cp."updatedAt", cp.id)
  );

-- Step 2: Normalize remaining PHONE and WHATSAPP contact points to digits only
UPDATE "ContactPoint"
SET "value" = regexp_replace("value", '\D', '', 'g')
WHERE "type" IN ('PHONE', 'WHATSAPP')
  AND "value" ~ '\D';
