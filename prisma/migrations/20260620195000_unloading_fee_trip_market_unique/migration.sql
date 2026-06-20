-- Deduplicate (trip_id, market) before adding unique constraint.
-- Prefer rows with overrides, then most recently updated.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY trip_id, market
      ORDER BY
        CASE
          WHEN unload_fee_override IS NOT NULL OR kpb_fee_override IS NOT NULL THEN 0
          ELSE 1
        END,
        updated_at DESC,
        id DESC
    ) AS rn
  FROM unloading_fees
)
DELETE FROM unloading_fees
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX "unloading_fees_trip_id_market_key" ON "unloading_fees"("trip_id", "market");
