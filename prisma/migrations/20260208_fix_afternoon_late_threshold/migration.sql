-- Fix historical afternoon check-ins incorrectly marked as late.
-- The late threshold for the AFTERNOON shift changed from 2:00 PM to 2:15 PM.
-- Teachers who clocked in between 14:00-14:15 CT were wrongly flagged as late.
-- This corrects those records by setting isLate = false where the clock-in time
-- (converted to America/Chicago timezone) falls at or before 14:15.

UPDATE "DugsiTeacherCheckIn"
SET "isLate" = false, "updatedAt" = NOW()
WHERE shift = 'AFTERNOON'
  AND "isLate" = true
  AND EXTRACT(HOUR FROM "clockInTime" AT TIME ZONE 'America/Chicago') = 14
  AND EXTRACT(MINUTE FROM "clockInTime" AT TIME ZONE 'America/Chicago') <= 15;
