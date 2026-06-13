-- Sync tong_types display_order with canonical report column order (BOX last)
UPDATE tong_types SET display_order = 1 WHERE code = 'ABB';
UPDATE tong_types SET display_order = 2 WHERE code = 'WTL';
UPDATE tong_types SET display_order = 3 WHERE code = 'BHR';
UPDATE tong_types SET display_order = 4 WHERE code = 'LL_BHR';
UPDATE tong_types SET display_order = 5 WHERE code = 'VIO';
UPDATE tong_types SET display_order = 6 WHERE code = 'MAR';
UPDATE tong_types SET display_order = 7 WHERE code = 'SHK';
UPDATE tong_types SET display_order = 8 WHERE code = 'GKS';
UPDATE tong_types SET display_order = 9 WHERE code = 'BRO';
UPDATE tong_types SET display_order = 10 WHERE code = 'GLY';
UPDATE tong_types SET display_order = 11 WHERE code = 'BS';
UPDATE tong_types SET display_order = 12 WHERE code = 'BH';
UPDATE tong_types SET display_order = 13 WHERE code = 'SHS';
UPDATE tong_types SET display_order = 14 WHERE code = 'OTHER';
UPDATE tong_types SET display_order = 15 WHERE code = 'BOX';

SELECT code, display_order FROM tong_types ORDER BY display_order;
