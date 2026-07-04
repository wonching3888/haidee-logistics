-- Per-trip Thai vehicle trips (plate + station + qty; not driver-day aggregate).
CREATE TABLE IF NOT EXISTS "thai_vehicle_trip_daily" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "truck_plate" TEXT NOT NULL,
    "driver_id" UUID,
    "station" TEXT NOT NULL,
    "tong_qty" INTEGER NOT NULL DEFAULT 0,
    "box_qty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thai_vehicle_trip_daily_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "thai_vehicle_trip_daily_date_idx" ON "thai_vehicle_trip_daily"("date");
CREATE INDEX IF NOT EXISTS "thai_vehicle_trip_daily_truck_plate_date_idx" ON "thai_vehicle_trip_daily"("truck_plate", "date");
CREATE INDEX IF NOT EXISTS "thai_vehicle_trip_daily_station_date_idx" ON "thai_vehicle_trip_daily"("station", "date");
CREATE INDEX IF NOT EXISTS "thai_vehicle_trip_daily_driver_id_date_idx" ON "thai_vehicle_trip_daily"("driver_id", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thai_vehicle_trip_daily_driver_id_fkey'
  ) THEN
    ALTER TABLE "thai_vehicle_trip_daily"
      ADD CONSTRAINT "thai_vehicle_trip_daily_driver_id_fkey"
      FOREIGN KEY ("driver_id") REFERENCES "thai_drivers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
