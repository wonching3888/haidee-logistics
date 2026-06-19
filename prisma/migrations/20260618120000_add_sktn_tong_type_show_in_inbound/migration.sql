-- Add inbound visibility flag (SKTN and future import-only crate types use show_in_inbound = false).
ALTER TABLE "tong_types" ADD COLUMN "show_in_inbound" BOOLEAN NOT NULL DEFAULT true;

-- Make room for SKTN after GLY (display_order 11).
UPDATE "tong_types"
SET "display_order" = "display_order" + 1
WHERE "display_order" >= 11;

INSERT INTO "tong_types" (
  "id",
  "code",
  "name",
  "track_inventory",
  "is_box",
  "display_order",
  "active",
  "show_in_inbound"
)
VALUES (
  gen_random_uuid(),
  'SKTN',
  'TAWAKAR',
  true,
  false,
  11,
  true,
  false
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "track_inventory" = EXCLUDED."track_inventory",
  "display_order" = EXCLUDED."display_order",
  "active" = EXCLUDED."active",
  "show_in_inbound" = EXCLUDED."show_in_inbound";
