-- Songkhla/Pattani: replace "direct/no_check deduction" with nullable full billable overrides.
-- No production business data on the old columns yet (test-only); drop and add cleanly.
-- SADAO no_check columns are unchanged.

ALTER TABLE "songkhla_crate_handling_daily"
  DROP COLUMN IF EXISTS "small_crate_no_check_qty",
  DROP COLUMN IF EXISTS "large_crate_no_check_qty",
  DROP COLUMN IF EXISTS "box_no_check_qty";

ALTER TABLE "songkhla_crate_handling_daily"
  ADD COLUMN IF NOT EXISTS "crate_billable_override_qty" INTEGER,
  ADD COLUMN IF NOT EXISTS "box_billable_override_qty" INTEGER;

ALTER TABLE "pattani_crate_handling_daily"
  DROP COLUMN IF EXISTS "crate_no_check_qty",
  DROP COLUMN IF EXISTS "box_no_check_qty";

ALTER TABLE "pattani_crate_handling_daily"
  ADD COLUMN IF NOT EXISTS "crate_billable_override_qty" INTEGER,
  ADD COLUMN IF NOT EXISTS "box_billable_override_qty" INTEGER;
