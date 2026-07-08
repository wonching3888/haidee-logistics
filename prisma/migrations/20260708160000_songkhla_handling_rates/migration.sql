-- Songkhla unified handling rates (nullable on snapshots = legacy Sadao split billing).
ALTER TABLE "thai_cost_monthly_rate_snapshots"
ADD COLUMN "songkhla_crate_rate" DECIMAL(12,4),
ADD COLUMN "songkhla_box_rate" DECIMAL(12,4);
