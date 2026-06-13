INSERT INTO markets (code, name, active, display_order)
VALUES ('OTHER', 'OTHER', true, 15)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    active = true,
    display_order = EXCLUDED.display_order;

-- Keep standard market display order aligned with MARKET_ORDER
UPDATE markets SET display_order = 1 WHERE code = 'KL';
UPDATE markets SET display_order = 2 WHERE code = 'BP';
UPDATE markets SET display_order = 3 WHERE code = 'MP';
UPDATE markets SET display_order = 4 WHERE code = 'SL';
UPDATE markets SET display_order = 5 WHERE code = 'MC';
UPDATE markets SET display_order = 6 WHERE code = 'A';
UPDATE markets SET display_order = 7 WHERE code = 'BM';
UPDATE markets SET display_order = 8 WHERE code = 'P';
UPDATE markets SET display_order = 9 WHERE code = 'TP';
UPDATE markets SET display_order = 10 WHERE code = 'NT';
UPDATE markets SET display_order = 11 WHERE code = 'KT';
UPDATE markets SET display_order = 12 WHERE code = 'SA';
UPDATE markets SET display_order = 13 WHERE code = 'KD';
UPDATE markets SET display_order = 14 WHERE code = 'JB';
UPDATE markets SET display_order = 15 WHERE code = 'OTHER';
