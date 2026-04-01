-- Migrate existing 10-digit US phone numbers to E.164 format
-- Before: '6125551234' (10 digits, US-only)
-- After:  '+16125551234' (E.164, internationally compatible)
UPDATE "Person" SET phone = '+1' || phone WHERE phone ~ '^\d{10}$';
