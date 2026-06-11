-- Crate type migration (reference SQL for Supabase SQL Editor)
-- Prefer: node scripts/migrate-crate-types.mjs (handles FK merges safely)

-- 1. GSK → GKS
UPDATE tong_types SET code = 'GKS', name = 'GKS'
WHERE code = 'GSK';

-- 2. Merge HD_BHR, BH_BHR, LYS_BHR into BHR
INSERT INTO tong_types (code, name, track_inventory)
SELECT 'BHR', 'BHR', true
WHERE NOT EXISTS (SELECT 1 FROM tong_types WHERE code = 'BHR');

UPDATE inbound_lines SET tong_type_id = (SELECT id FROM tong_types WHERE code = 'BHR')
WHERE tong_type_id IN (SELECT id FROM tong_types WHERE code IN ('HD_BHR','BH_BHR','LYS_BHR'));

UPDATE inbound_lines SET original_tong_type_id = (SELECT id FROM tong_types WHERE code = 'BHR')
WHERE original_tong_type_id IN (SELECT id FROM tong_types WHERE code IN ('HD_BHR','BH_BHR','LYS_BHR'));

UPDATE customer_crate_stock SET tong_type_id = (SELECT id FROM tong_types WHERE code = 'BHR')
WHERE tong_type_id IN (SELECT id FROM tong_types WHERE code IN ('HD_BHR','BH_BHR','LYS_BHR'));

UPDATE customer_crate_ledger SET tong_type_id = (SELECT id FROM tong_types WHERE code = 'BHR')
WHERE tong_type_id IN (SELECT id FROM tong_types WHERE code IN ('HD_BHR','BH_BHR','LYS_BHR'));

UPDATE tong_imports SET tong_type_id = (SELECT id FROM tong_types WHERE code = 'BHR')
WHERE tong_type_id IN (SELECT id FROM tong_types WHERE code IN ('HD_BHR','BH_BHR','LYS_BHR'));

UPDATE tong_exports SET tong_type_id = (SELECT id FROM tong_types WHERE code = 'BHR')
WHERE tong_type_id IN (SELECT id FROM tong_types WHERE code IN ('HD_BHR','BH_BHR','LYS_BHR'));

DELETE FROM tong_types WHERE code IN ('HD_BHR','BH_BHR','LYS_BHR');

-- 3. New types
INSERT INTO tong_types (code, name, track_inventory) VALUES
('BAN_HENG', 'Ban Heng', true),
('SAHASIN', 'Sahasin', true),
('OTHER', 'Other', false)
ON CONFLICT (code) DO NOTHING;
