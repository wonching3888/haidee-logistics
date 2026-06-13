-- Sync KL / SL market display names across master data and legacy text fields
UPDATE markets
SET name = 'SELAYANG'
WHERE code = 'KL'
   OR name ILIKE 'KUALA LUMPUR'
   OR name ILIKE 'K.L.%';

UPDATE markets
SET name = 'SEREMBAN'
WHERE code = 'SL'
   OR name ILIKE 'SELANGOR';

UPDATE inbound_sessions
SET area_note = 'SELAYANG'
WHERE area_note ILIKE 'KUALA LUMPUR';

UPDATE inbound_sessions
SET area_note = 'SEREMBAN'
WHERE area_note ILIKE 'SELANGOR';

UPDATE tong_exports
SET area_note = 'SELAYANG'
WHERE area_note ILIKE 'KUALA LUMPUR';

UPDATE tong_exports
SET area_note = 'SEREMBAN'
WHERE area_note ILIKE 'SELANGOR';
