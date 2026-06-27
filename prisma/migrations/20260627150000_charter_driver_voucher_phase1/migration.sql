-- Batch 0: charter driver voucher phase 1 (schema only for override cols; tripSource for binding)

-- driver_vouchers.tripSource (camelCase column)
ALTER TABLE "driver_vouchers" ADD COLUMN "tripSource" TEXT NOT NULL DEFAULT 'dispatch';

UPDATE "driver_vouchers" SET "tripSource" = 'dispatch' WHERE "tripSource" IS NULL;

-- Replace trip_id-only unique with (trip_id, tripSource)
DROP INDEX IF EXISTS "driver_vouchers_trip_id_key";

CREATE UNIQUE INDEX "driver_vouchers_trip_id_tripSource_key" ON "driver_vouchers"("trip_id", "tripSource");

CREATE INDEX "driver_vouchers_tripSource_idx" ON "driver_vouchers"("tripSource");

-- charter_trips override columns (camelCase; not read/written in phase 1)
ALTER TABLE "charter_trips" ADD COLUMN "charterUnloadFeeOverride" DECIMAL(10,2);
ALTER TABLE "charter_trips" ADD COLUMN "charterOtherCostOverride" DECIMAL(10,2);
ALTER TABLE "charter_trips" ADD COLUMN "charterBorderPassOverride" DECIMAL(10,2);
ALTER TABLE "charter_trips" ADD COLUMN "charterLoadingLaborMyr" DECIMAL(10,2);
