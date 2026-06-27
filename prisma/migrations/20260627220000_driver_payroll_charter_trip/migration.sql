-- Link charter trips to driver payroll rows for crate-return commission (separate from charter fixed salary).
ALTER TABLE "driver_payroll_trips" ADD COLUMN "charter_trip_id" UUID;

CREATE UNIQUE INDEX "driver_payroll_trips_charter_trip_id_key" ON "driver_payroll_trips"("charter_trip_id");

ALTER TABLE "driver_payroll_trips" ADD CONSTRAINT "driver_payroll_trips_charter_trip_id_fkey" FOREIGN KEY ("charter_trip_id") REFERENCES "charter_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
