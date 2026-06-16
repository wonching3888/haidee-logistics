ALTER TABLE route_masters
  ADD COLUMN IF NOT EXISTS toll_fee_class2 DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS toll_fee_class3 DECIMAL(10, 2);

UPDATE route_masters
SET toll_fee_class3 = COALESCE(toll_fee_class3, toll_fee)
WHERE toll_fee IS NOT NULL;

ALTER TABLE trucks
  ADD COLUMN IF NOT EXISTS toll_class VARCHAR(20) NOT NULL DEFAULT 'class3';

UPDATE trucks
SET toll_class = 'class2'
WHERE UPPER(plate) IN ('KFR3888', 'PQL3888', 'PQH3888', 'PQJ3888');
