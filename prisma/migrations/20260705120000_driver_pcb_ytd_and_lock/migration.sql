-- PCB YTD balances (end-of-month cumulative Y/K/X for next-month auto PCB).
CREATE TABLE "driver_pcb_ytd_balances" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "as_of_year_month" TEXT NOT NULL,
    "accumulated_gross_y" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "accumulated_epf_k" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "accumulated_mtd_x" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "accumulated_zakat_z" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_pcb_ytd_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "driver_pcb_ytd_balances_driver_id_as_of_year_month_key"
  ON "driver_pcb_ytd_balances"("driver_id", "as_of_year_month");

CREATE INDEX "driver_pcb_ytd_balances_as_of_year_month_idx"
  ON "driver_pcb_ytd_balances"("as_of_year_month");

ALTER TABLE "driver_pcb_ytd_balances"
  ADD CONSTRAINT "driver_pcb_ytd_balances_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "drivers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Monthly PCB lock snapshot on payroll month (freeze auto result + inputs).
ALTER TABLE "driver_payroll_months"
  ADD COLUMN "pcb_computed" DECIMAL(10,2),
  ADD COLUMN "pcb_final" DECIMAL(10,2),
  ADD COLUMN "pcb_locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pcb_locked_at" TIMESTAMP(3),
  ADD COLUMN "pcb_snapshot_ytd_gross" DECIMAL(12,2),
  ADD COLUMN "pcb_snapshot_ytd_epf" DECIMAL(12,2),
  ADD COLUMN "pcb_snapshot_ytd_mtd" DECIMAL(12,2),
  ADD COLUMN "pcb_snapshot_month_gross" DECIMAL(12,2),
  ADD COLUMN "pcb_snapshot_month_epf" DECIMAL(12,2);
