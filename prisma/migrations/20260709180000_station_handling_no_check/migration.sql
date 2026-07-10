-- Songkhla / Pattani handling: direct (no-check) qty fields, same pattern as Sadao.

ALTER TABLE "songkhla_crate_handling_daily"
  ADD COLUMN IF NOT EXISTS "small_crate_no_check_qty" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "large_crate_no_check_qty" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "box_no_check_qty" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "pattani_crate_handling_daily"
  ADD COLUMN IF NOT EXISTS "crate_no_check_qty" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "box_no_check_qty" INTEGER NOT NULL DEFAULT 0;
