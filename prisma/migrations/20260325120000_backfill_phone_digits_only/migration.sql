-- Step 1: Deactivate duplicate contacts that would collide after normalization.
-- When multiple active contacts of the same type normalize to the same digits,
-- keep the most recently updated one and deactivate the rest.
UPDATE "ContactPoint" cp
SET "isActive" = false,
    "deactivatedAt" = NOW()
WHERE cp."type" IN ('PHONE', 'WHATSAPP')
  AND cp."isActive" = true
  AND cp."value" ~ '\D'
  AND EXISTS (
    SELECT 1 FROM "ContactPoint" other
    WHERE other."type" = cp."type"
      AND other."isActive" = true
      AND other.id != cp.id
      AND regexp_replace(other."value", '\D', '', 'g') = regexp_replace(cp."value", '\D', '', 'g')
      AND other."updatedAt" > cp."updatedAt"
  );

-- Step 2: Normalize remaining PHONE and WHATSAPP contact points to digits only
UPDATE "ContactPoint"
SET "value" = regexp_replace("value", '\D', '', 'g')
WHERE "type" IN ('PHONE', 'WHATSAPP')
  AND "value" ~ '\D';
