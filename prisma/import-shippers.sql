-- Haidee Logistics: import 68 AutoCount shippers
-- Run in Supabase Dashboard → SQL Editor
-- Note: column names match Prisma schema (not AutoCount export names)

BEGIN;

-- Step 1: Remove seed shippers (S001–S003) and dependent rows
DO $$
DECLARE
  seed_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO seed_ids FROM shippers WHERE code IN ('S001', 'S002', 'S003');
  IF seed_ids IS NOT NULL THEN
    DELETE FROM dispatch_lines
    WHERE inbound_line_id IN (
      SELECT il.id FROM inbound_lines il
      JOIN inbound_sessions s ON s.id = il.session_id
      WHERE s.shipper_id = ANY(seed_ids)
    );
    DELETE FROM inbound_lines
    WHERE session_id IN (SELECT id FROM inbound_sessions WHERE shipper_id = ANY(seed_ids));
    DELETE FROM inbound_sessions WHERE shipper_id = ANY(seed_ids);
    DELETE FROM tong_exports WHERE shipper_id = ANY(seed_ids);
    DELETE FROM shipper_stall_defaults WHERE shipper_id = ANY(seed_ids);
    DELETE FROM freight_rates WHERE shipper_id = ANY(seed_ids);
    DELETE FROM th_vehicles WHERE shipper_id = ANY(seed_ids);
    DELETE FROM shippers WHERE id = ANY(seed_ids);
  END IF;
END $$;

-- Step 2: Insert 68 shippers (default_tong_type_id = ABB)
INSERT INTO shippers (code, name, default_tong_type_id, payment_party, company, active)
SELECT v.code, v.name, t.id, v.payment_party, 'haidee', true
FROM (VALUES
  ('3001-A001', 'ARSAN FISHERY', 'shipper'),
  ('3001-A002', 'AIK HUAT', 'shipper'),
  ('3001-A003', 'ANN - RANONG', 'shipper'),
  ('3001-A004', 'AR MEI - PATTANI', 'shipper'),
  ('3001-A005', 'ARUN - PHUKET', 'shipper'),
  ('3001-A006', 'AR MEI - RANONG', 'shipper'),
  ('3001-A007', 'ANN - PATTANI', 'shipper'),
  ('3001-A008', 'ANYA SEAFOOD', 'shipper'),
  ('3001-A009', 'AH HENG FISHERY', 'shipper'),
  ('3001-A010', 'AR MUI - PATTANI', 'shipper'),
  ('3001-B001', 'BROTHER - PATTANI', 'shipper'),
  ('3001-B002', 'BAN HENG TRADING CO LTD', 'shipper'),
  ('3001-C001', 'CHALEE FISHERY', 'shipper'),
  ('3001-C002', 'CHUN MENG', 'shipper'),
  ('3001-C003', 'CH FISHERY', 'shipper'),
  ('3001-C004', 'CT - PATTANI', 'shipper'),
  ('3001-C005', 'CT - SONGKHLA', 'shipper'),
  ('3001-C006', 'C P', 'shipper'),
  ('3001-C007', 'CHAH', 'shipper'),
  ('3001-D001', 'DING SENG - PATTANI', 'shipper'),
  ('3001-D002', 'DOLPHIN', 'shipper'),
  ('3001-G001', 'GONG', 'shipper'),
  ('3001-G002', 'GUAN - HATYAI', 'shipper'),
  ('3001-H001', 'HONG LEE', 'shipper'),
  ('3001-H002', 'HAI SENG HUAT', 'shipper'),
  ('3001-H003', 'HENG - PHUKET', 'shipper'),
  ('3001-H004', 'HENG DEE', 'shipper'),
  ('3001-H005', 'HUP HUAT', 'shipper'),
  ('3001-H006', 'HONG MENG FISHERY', 'shipper'),
  ('3001-H007', 'HUAT SYARIKAT (LIM PTN)', 'shipper'),
  ('3001-H008', 'HENG HUAT', 'shipper'),
  ('3001-H009', 'HUP DEE TRANSPORT CO LTD', 'shipper'),
  ('3001-H010', 'HENG RUNG SAENG CO LTD', 'shipper'),
  ('3001-K001', 'KWAN - PHUKET', 'shipper'),
  ('3001-K002', 'KH - RANONG', 'shipper'),
  ('3001-K003', 'KHOON WENG TRANSPORT LTD', 'shipper'),
  ('3001-L001', 'L.A.FISHERY - PHUKET', 'shipper'),
  ('3001-M001', 'MEENA', 'shipper'),
  ('3001-N001', 'NAI LEAT', 'shipper'),
  ('3001-N002', 'NAM SENG', 'shipper'),
  ('3001-N003', 'NAI MENG', 'shipper'),
  ('3001-N004', 'NY - RANONG', 'shipper'),
  ('3001-N005', 'NR FISHERY', 'shipper'),
  ('3001-N006', 'NAZAE - PATTANI', 'shipper'),
  ('3001-P001', 'PPR - PHUKET', 'shipper'),
  ('3001-P002', 'PRANACHAI', 'shipper'),
  ('3001-P003', 'PNN', 'shipper'),
  ('3001-P004', 'POR - PATTANI', 'shipper'),
  ('3001-P005', 'PIN SEA PRODUCT - LAI HUAT', 'shipper'),
  ('3001-P006', 'PRIM', 'shipper'),
  ('3001-P007', 'PT PHUKET', 'shipper'),
  ('3001-P008', 'PPR - SONGKHLA', 'shipper'),
  ('3001-R001', 'RB - PATTANI', 'shipper'),
  ('3001-S001', 'SENG HUAT - TAKOR', 'shipper'),
  ('3001-S002', 'SOON - SONGKHLA', 'shipper'),
  ('3001-S003', 'SAHASIN - HY', 'shipper'),
  ('3001-S004', 'SOON HENG', 'shipper'),
  ('3001-S005', 'SAI - RANONG', 'shipper'),
  ('3001-S006', 'SOH - SK', 'shipper'),
  ('3001-S007', 'SOMPONG - SK', 'shipper'),
  ('3001-S008', 'SAHASIN - SK', 'C.O.D.'),
  ('3001-T001', 'THAI LAI', 'shipper'),
  ('3001-T002', 'TAT KHENG', 'shipper'),
  ('3001-T003', 'THAI TONG FISHERY', 'shipper'),
  ('3001-T004', 'TUI PATTANI', 'shipper'),
  ('3001-V001', 'VP FISHERY', 'shipper'),
  ('3001-W001', 'WAN - SONGKHLA', 'shipper'),
  ('3001-Y001', 'YIN - SONGKHLA', 'shipper'),
  ('3001-Y002', 'Y S', 'shipper'),
  ('3001-Y003', 'YUNG SU', 'shipper'),
  ('3010-S001', 'SOMPONG (SST)', 'C.O.D.')
) AS v(code, name, payment_party)
CROSS JOIN tong_types t
WHERE t.code = 'ABB'
ON CONFLICT (code) DO NOTHING;

COMMIT;

SELECT COUNT(*) AS total_shippers FROM shippers;
