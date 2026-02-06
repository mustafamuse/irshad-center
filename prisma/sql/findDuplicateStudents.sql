WITH duplicate_phones AS (
  SELECT cp.value AS contact_value
  FROM "ProgramProfile" pp
  JOIN "Person" p ON p.id = pp."personId"
  JOIN "ContactPoint" cp ON cp."personId" = p.id
  WHERE pp.program = 'MAHAD_PROGRAM'
    AND cp.type IN ('PHONE', 'WHATSAPP')
  GROUP BY cp.value
  HAVING COUNT(DISTINCT pp.id) >= 2
)
SELECT
  pp.id AS profile_id,
  p.name AS person_name,
  cp.value AS contact_value,
  pp.status AS enrollment_status,
  pp."updatedAt" AS profile_updated_at
FROM "ProgramProfile" pp
JOIN "Person" p ON p.id = pp."personId"
JOIN "ContactPoint" cp ON cp."personId" = p.id
WHERE pp.program = 'MAHAD_PROGRAM'
  AND cp.type IN ('PHONE', 'WHATSAPP')
  AND cp.value IN (SELECT contact_value FROM duplicate_phones)
ORDER BY cp.value, pp."updatedAt" DESC
