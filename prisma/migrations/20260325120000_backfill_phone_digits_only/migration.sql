-- Step 1: Deactivate older duplicate contacts that would collide after normalization.
-- Scoped to the same person to avoid cross-person false matches.
-- No cp."value" ~ '\D' filter so we also catch digits-only older rows
-- when the newer duplicate is the formatted one.
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
      AND other."updatedAt" > cp."updatedAt"
  );

-- Step 2: Normalize remaining PHONE and WHATSAPP contact points to digits only
UPDATE "ContactPoint"
SET "value" = regexp_replace("value", '\D', '', 'g')
WHERE "type" IN ('PHONE', 'WHATSAPP')
  AND "value" ~ '\D';
