-- Haidee Logistics: clear automated test data
-- Run in Supabase Dashboard → SQL Editor
-- (Table/column names match Prisma schema)

BEGIN;

-- Resolve test shipper id(s)
CREATE TEMP TABLE _test_shippers ON COMMIT DROP AS
SELECT id FROM shippers
WHERE name = '测试商家A' OR code = 'S_TEST';

-- Inbound + dispatch links for test shipper
DELETE FROM dispatch_lines
WHERE inbound_line_id IN (
  SELECT il.id FROM inbound_lines il
  JOIN inbound_sessions s ON s.id = il.session_id
  WHERE s.shipper_id IN (SELECT id FROM _test_shippers)
);

DELETE FROM inbound_lines
WHERE session_id IN (
  SELECT id FROM inbound_sessions
  WHERE shipper_id IN (SELECT id FROM _test_shippers)
);

DELETE FROM inbound_sessions
WHERE shipper_id IN (SELECT id FROM _test_shippers);

-- Test dispatch orders (batch 5 driver)
DELETE FROM dispatch_lines
WHERE dispatch_order_id IN (
  SELECT id FROM dispatch_orders WHERE driver_name = '测试司机'
);

DELETE FROM dispatch_orders WHERE driver_name = '测试司机';

-- Tong export for test shipper
DELETE FROM tong_exports
WHERE shipper_id IN (SELECT id FROM _test_shippers);

-- Today's tong import rows (batch 6 truck-based test)
DELETE FROM tong_imports WHERE date = CURRENT_DATE;

-- Test master data
DELETE FROM shipper_stall_defaults
WHERE shipper_id IN (SELECT id FROM _test_shippers);

DELETE FROM freight_rates
WHERE shipper_id IN (SELECT id FROM _test_shippers);

DELETE FROM th_vehicles WHERE plate = '70-TEST1';

DELETE FROM stalls
WHERE code = 'T01'
  AND market_id = (SELECT id FROM markets WHERE code = 'KL' LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM inbound_lines il WHERE il.stall_id = stalls.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM shipper_stall_defaults d WHERE d.stall_id = stalls.id
  );

DELETE FROM shippers
WHERE id IN (SELECT id FROM _test_shippers);

COMMIT;
