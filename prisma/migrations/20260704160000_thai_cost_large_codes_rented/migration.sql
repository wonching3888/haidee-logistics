-- Thai-cost-only large tong codes (independent of MY unloading VIO/BS).
-- External rented vehicle trips for Songkhla/Pattani.

ALTER TABLE "thai_cost_rate_settings" ADD COLUMN IF NOT EXISTS "value_text" TEXT;

INSERT INTO "thai_cost_rate_settings" ("id", "key", "value", "value_text", "updated_at") VALUES
(gen_random_uuid(), 'large_tong_type_codes', 0, '["VIO","BS","GKS"]', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "value_text" = EXCLUDED."value_text";

ALTER TABLE "thai_cost_monthly_rate_snapshots"
  ADD COLUMN IF NOT EXISTS "large_tong_type_codes" TEXT NOT NULL DEFAULT '["VIO","BS","GKS"]';

CREATE TABLE IF NOT EXISTS "thai_rented_vehicle_trips" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "station" TEXT NOT NULL,
    "driver_name" TEXT NOT NULL,
    "truck_plate" TEXT,
    "trip_cost" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thai_rented_vehicle_trips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "thai_rented_vehicle_trips_station_date_idx"
  ON "thai_rented_vehicle_trips"("station", "date");
