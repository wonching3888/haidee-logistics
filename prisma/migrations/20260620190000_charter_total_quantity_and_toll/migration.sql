-- Charter: manual total quantity (P&L/ops) and toll fee
ALTER TABLE "charter_trips" ADD COLUMN "total_quantity" INTEGER;
ALTER TABLE "charter_trips" ADD COLUMN "charter_toll_myr" DECIMAL(10,2);

-- Backfill total_quantity from line sums where missing
UPDATE "charter_trips" t
SET "total_quantity" = sub.sum_qty
FROM (
  SELECT "charter_trip_id", COALESCE(SUM("quantity"), 0) AS sum_qty
  FROM "charter_trip_lines"
  GROUP BY "charter_trip_id"
) sub
WHERE t."id" = sub."charter_trip_id"
  AND t."total_quantity" IS NULL;
