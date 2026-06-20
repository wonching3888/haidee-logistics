-- CreateTable
CREATE TABLE "charter_trip_finances" (
    "id" UUID NOT NULL,
    "dispatch_order_id" UUID NOT NULL,
    "charter_class" TEXT NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charter_trip_finances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "charter_trip_finances_dispatch_order_id_key" ON "charter_trip_finances"("dispatch_order_id");

-- AddForeignKey
ALTER TABLE "charter_trip_finances" ADD CONSTRAINT "charter_trip_finances_dispatch_order_id_fkey" FOREIGN KEY ("dispatch_order_id") REFERENCES "dispatch_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
