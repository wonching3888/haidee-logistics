-- Monthly worker allowances (LUNCH / FUEL / RENT ROOM)
ALTER TABLE "thai_monthly_workers" ADD COLUMN "lunch_allowance" DECIMAL(12,2) NOT NULL DEFAULT 1000;
ALTER TABLE "thai_monthly_workers" ADD COLUMN "fuel_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "thai_monthly_workers" ADD COLUMN "rent_room_allowance" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Monthly roster headcount for daily-wage labor LUNCH (fixed per person, not pro-rated)
CREATE TABLE "thai_daily_labor_monthly_rosters" (
    "id" UUID NOT NULL,
    "year_month" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "roster_count" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thai_daily_labor_monthly_rosters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thai_daily_labor_monthly_rosters_year_month_station_key"
  ON "thai_daily_labor_monthly_rosters"("year_month", "station");

-- Sadao handling: BOX category (rate 3 THB, same as small crate)
ALTER TABLE "sadao_crate_handling_daily" ADD COLUMN "box_total_qty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sadao_crate_handling_daily" ADD COLUMN "box_no_check_qty" INTEGER NOT NULL DEFAULT 0;
