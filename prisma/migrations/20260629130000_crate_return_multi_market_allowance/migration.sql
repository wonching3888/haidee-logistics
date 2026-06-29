-- Crate return multi-market allowance (independent from outbound trip allowance)
ALTER TABLE "payroll_allowance_settings"
ADD COLUMN IF NOT EXISTS "crate_return_multi_market_allowance" DECIMAL(10,2) DEFAULT 30;

UPDATE "payroll_allowance_settings"
SET "crate_return_multi_market_allowance" = COALESCE("crate_return_multi_market_allowance", 30)
WHERE id = 'default';

ALTER TABLE "driver_payroll_trips"
ADD COLUMN IF NOT EXISTS "crate_return_multi_market_allowance" DECIMAL(10,2) NOT NULL DEFAULT 0;
