-- Drop dispatch-linked charter finance (superseded by standalone charter_trips)
DROP TABLE IF EXISTS "charter_trip_finances";

-- CreateTable
CREATE TABLE "charter_trips" (
    "id" UUID NOT NULL,
    "charter_no" TEXT,
    "date" DATE NOT NULL,
    "truck_id" UUID NOT NULL,
    "driver_name" TEXT,
    "cargo_type" TEXT NOT NULL,
    "include_border_fees" BOOLEAN NOT NULL DEFAULT false,
    "charter_mileage_km" DECIMAL(10,2) NOT NULL,
    "charter_revenue_myr" DECIMAL(12,2) NOT NULL,
    "charter_unload_fee_myr" DECIMAL(10,2),
    "charter_driver_salary_myr" DECIMAL(10,2),
    "charter_other_cost_myr" DECIMAL(10,2),
    "charter_other_cost_note" TEXT,
    "charter_extra_revenue_myr" DECIMAL(10,2),
    "charter_extra_revenue_note" TEXT,
    "charter_extra_cost_myr" DECIMAL(10,2),
    "charter_extra_cost_note" TEXT,
    "computed_lkim_myr" DECIMAL(10,2),
    "computed_crate_rental_myr" DECIMAL(10,2),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charter_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charter_trip_lines" (
    "id" UUID NOT NULL,
    "charter_trip_id" UUID NOT NULL,
    "tong_type_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "charter_trip_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "charter_trips_charter_no_key" ON "charter_trips"("charter_no");

-- CreateIndex
CREATE INDEX "charter_trips_date_idx" ON "charter_trips"("date");

-- CreateIndex
CREATE INDEX "charter_trip_lines_charter_trip_id_idx" ON "charter_trip_lines"("charter_trip_id");

-- AddForeignKey
ALTER TABLE "charter_trips" ADD CONSTRAINT "charter_trips_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charter_trips" ADD CONSTRAINT "charter_trips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charter_trip_lines" ADD CONSTRAINT "charter_trip_lines_charter_trip_id_fkey" FOREIGN KEY ("charter_trip_id") REFERENCES "charter_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charter_trip_lines" ADD CONSTRAINT "charter_trip_lines_tong_type_id_fkey" FOREIGN KEY ("tong_type_id") REFERENCES "tong_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
