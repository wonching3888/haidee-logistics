-- WTL dual-segment freight rates (all amounts in MYR).
-- rate_tong_thai / rate_box_thai: Thailand segment (MYR, no SST).
-- rate_tong / rate_box: Malaysia segment base (MYR, +6% SST when sst_applicable).

ALTER TABLE freight_rates
  ADD COLUMN IF NOT EXISTS rate_tong_thai DECIMAL(10, 2);

ALTER TABLE freight_rates
  ADD COLUMN IF NOT EXISTS rate_box_thai DECIMAL(10, 2);

ALTER TABLE freight_rates
  ADD COLUMN IF NOT EXISTS is_wtl BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE freight_rates
  ADD COLUMN IF NOT EXISTS sst_applicable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE consignee_freight_rates
  ADD COLUMN IF NOT EXISTS rate_tong_thai DECIMAL(10, 2);

ALTER TABLE consignee_freight_rates
  ADD COLUMN IF NOT EXISTS rate_box_thai DECIMAL(10, 2);

ALTER TABLE consignee_freight_rates
  ADD COLUMN IF NOT EXISTS sst_applicable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE consignee_freight_rates
  ADD COLUMN IF NOT EXISTS permit_per_trip DECIMAL(10, 2);
