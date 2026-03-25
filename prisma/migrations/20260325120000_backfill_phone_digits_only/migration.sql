-- Backfill: normalize PHONE and WHATSAPP contact points to digits only
UPDATE "ContactPoint"
SET "value" = regexp_replace("value", '\D', '', 'g')
WHERE "type" IN ('PHONE', 'WHATSAPP')
  AND "value" ~ '\D';
