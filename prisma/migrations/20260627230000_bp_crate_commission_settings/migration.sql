-- BP market crate-return commission tiers (configurable in payroll settings).
ALTER TABLE "payroll_allowance_settings" ADD COLUMN "bp_crate_commission_big_truck" DECIMAL(10,2) DEFAULT 210;
ALTER TABLE "payroll_allowance_settings" ADD COLUMN "bp_crate_commission_small_truck" DECIMAL(10,2) DEFAULT 190;

UPDATE "payroll_allowance_settings"
SET
  "bp_crate_commission_big_truck" = COALESCE("bp_crate_commission_big_truck", 210),
  "bp_crate_commission_small_truck" = COALESCE("bp_crate_commission_small_truck", 190)
WHERE id = 'default';
