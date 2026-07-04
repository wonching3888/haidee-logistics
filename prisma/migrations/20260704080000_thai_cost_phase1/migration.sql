-- Thai cost Phase 2 stage 1: monthly workers, daily labor attendance,
-- Thai drivers (master only), Sadao crate handling daily.

CREATE TABLE "thai_monthly_workers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "monthly_wage" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thai_monthly_workers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "thai_monthly_workers_station_active_idx" ON "thai_monthly_workers"("station", "active");

CREATE TABLE "thai_daily_labor_attendance" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "station" TEXT NOT NULL,
    "attendance_count" INTEGER NOT NULL,
    "daily_wage" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thai_daily_labor_attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thai_daily_labor_attendance_date_station_key" ON "thai_daily_labor_attendance"("date", "station");
CREATE INDEX "thai_daily_labor_attendance_station_date_idx" ON "thai_daily_labor_attendance"("station", "date");

CREATE TABLE "thai_drivers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "base_wage" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thai_drivers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "thai_drivers_active_idx" ON "thai_drivers"("active");

CREATE TABLE "sadao_crate_handling_daily" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "small_crate_total_qty" INTEGER NOT NULL,
    "large_crate_total_qty" INTEGER NOT NULL,
    "small_crate_no_check_qty" INTEGER NOT NULL DEFAULT 0,
    "large_crate_no_check_qty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sadao_crate_handling_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sadao_crate_handling_daily_date_key" ON "sadao_crate_handling_daily"("date");
