-- Replace billable-override columns with a single editable totals model:
-- manual_qty=false → display/billing follow live dispatch
-- manual_qty=true  → stored small/large/box (or crate/box) are the locked billable totals
-- SADAO unchanged.

ALTER TABLE "songkhla_crate_handling_daily"
  ADD COLUMN IF NOT EXISTS "manual_qty" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "songkhla_crate_handling_daily"
  DROP COLUMN IF EXISTS "crate_billable_override_qty",
  DROP COLUMN IF EXISTS "box_billable_override_qty";

ALTER TABLE "pattani_crate_handling_daily"
  ADD COLUMN IF NOT EXISTS "manual_qty" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "pattani_crate_handling_daily"
  DROP COLUMN IF EXISTS "crate_billable_override_qty",
  DROP COLUMN IF EXISTS "box_billable_override_qty";
