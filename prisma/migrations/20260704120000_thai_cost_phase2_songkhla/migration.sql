-- Phase 2: rate settings, monthly rate snapshots, segment internal cost snapshots,
-- Songkhla handling, driver trips.

CREATE TABLE "thai_cost_rate_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thai_cost_rate_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thai_cost_rate_settings_key_key" ON "thai_cost_rate_settings"("key");

-- Defaults match prior hardcoded constants
INSERT INTO "thai_cost_rate_settings" ("id", "key", "value", "updated_at") VALUES
(gen_random_uuid(), 'handling_small_weekday', 3, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'handling_small_holiday', 5, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'handling_large_weekday', 4, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'handling_large_holiday', 6, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'driver_trip_songkhla', 700, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'driver_trip_pattani', 1200, CURRENT_TIMESTAMP);

CREATE TABLE "thai_cost_monthly_rate_snapshots" (
    "id" UUID NOT NULL,
    "year_month" TEXT NOT NULL,
    "handling_small_weekday" DECIMAL(12,4) NOT NULL,
    "handling_small_holiday" DECIMAL(12,4) NOT NULL,
    "handling_large_weekday" DECIMAL(12,4) NOT NULL,
    "handling_large_holiday" DECIMAL(12,4) NOT NULL,
    "driver_trip_songkhla" DECIMAL(12,4) NOT NULL,
    "driver_trip_pattani" DECIMAL(12,4) NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID NOT NULL,

    CONSTRAINT "thai_cost_monthly_rate_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thai_cost_monthly_rate_snapshots_year_month_key"
  ON "thai_cost_monthly_rate_snapshots"("year_month");

CREATE TABLE "thai_segment_internal_cost_snapshots" (
    "id" UUID NOT NULL,
    "year_month" TEXT NOT NULL,
    "pickup_location" TEXT NOT NULL,
    "total_amount_myr" DECIMAL(14,2) NOT NULL,
    "rates_used_snapshot" JSONB NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID NOT NULL,

    CONSTRAINT "thai_segment_internal_cost_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thai_segment_internal_cost_snapshots_year_month_pickup_location_key"
  ON "thai_segment_internal_cost_snapshots"("year_month", "pickup_location");

CREATE TABLE "songkhla_crate_handling_daily" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "small_crate_total_qty" INTEGER NOT NULL,
    "large_crate_total_qty" INTEGER NOT NULL,
    "box_total_qty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "songkhla_crate_handling_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "songkhla_crate_handling_daily_date_key" ON "songkhla_crate_handling_daily"("date");

CREATE TABLE "thai_driver_trip_daily" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "driver_id" UUID NOT NULL,
    "songkhla_trip_count" INTEGER NOT NULL DEFAULT 0,
    "pattani_trip_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thai_driver_trip_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thai_driver_trip_daily_date_driver_id_key"
  ON "thai_driver_trip_daily"("date", "driver_id");
CREATE INDEX "thai_driver_trip_daily_date_idx" ON "thai_driver_trip_daily"("date");

ALTER TABLE "thai_driver_trip_daily"
  ADD CONSTRAINT "thai_driver_trip_daily_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "thai_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- thai_drivers.name unique for upsert seed
CREATE UNIQUE INDEX IF NOT EXISTS "thai_drivers_name_key" ON "thai_drivers"("name");
