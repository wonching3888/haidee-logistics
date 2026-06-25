-- Driver voucher workflow: status fields, change log, indexes, historical backfill.

-- AlterTable: workflow columns on driver_vouchers
ALTER TABLE "driver_vouchers" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "driver_vouchers" ADD COLUMN "clerk_submitted_at" TIMESTAMP(3);
ALTER TABLE "driver_vouchers" ADD COLUMN "clerk_submitted_by" TEXT;
ALTER TABLE "driver_vouchers" ADD COLUMN "clerk_confirmed_at" TIMESTAMP(3);
ALTER TABLE "driver_vouchers" ADD COLUMN "clerk_confirmed_by" TEXT;
ALTER TABLE "driver_vouchers" ADD COLUMN "clerk_flagged_at" TIMESTAMP(3);
ALTER TABLE "driver_vouchers" ADD COLUMN "clerk_flagged_by" TEXT;
ALTER TABLE "driver_vouchers" ADD COLUMN "reviewed_at" TIMESTAMP(3);
ALTER TABLE "driver_vouchers" ADD COLUMN "reviewed_by" TEXT;
ALTER TABLE "driver_vouchers" ADD COLUMN "rejected_at" TIMESTAMP(3);
ALTER TABLE "driver_vouchers" ADD COLUMN "rejected_by" TEXT;
ALTER TABLE "driver_vouchers" ADD COLUMN "cost_applied_at" TIMESTAMP(3);
ALTER TABLE "driver_vouchers" ADD COLUMN "clerk_note" TEXT;
ALTER TABLE "driver_vouchers" ADD COLUMN "review_note" TEXT;

-- Backfill historical status (idempotent: only rows still at default draft)
UPDATE "driver_vouchers"
SET
  "status" = 'confirmed',
  "cost_applied_at" = COALESCE("updated_at", "created_at")
WHERE
  "status" = 'draft'
  AND (
    "chop_border_actual" IS NOT NULL
    OR "parking_actual" IS NOT NULL
    OR "kpb_actual" IS NOT NULL
    OR "fish_check_actual" IS NOT NULL
    OR "upah_turun_actual" IS NOT NULL
    OR "upah_naik_tong_actual" IS NOT NULL
    OR "minyak_moto_actual" IS NOT NULL
    OR "other_actual" IS NOT NULL
    OR ("belanja" IS NOT NULL AND "belanja" > 0)
  );

-- trip_id: replace non-unique index with UNIQUE (safe when no duplicates)
DROP INDEX IF EXISTS "driver_vouchers_trip_id_idx";
CREATE UNIQUE INDEX "driver_vouchers_trip_id_key" ON "driver_vouchers"("trip_id");

-- List / filter indexes
CREATE INDEX "driver_vouchers_status_trip_date_idx" ON "driver_vouchers"("status", "trip_date" DESC);
CREATE INDEX "driver_vouchers_trip_date_lorry_idx" ON "driver_vouchers"("trip_date", "lorry");
CREATE INDEX "driver_vouchers_trip_date_driver_name_idx" ON "driver_vouchers"("trip_date", "driver_name");

-- Change log table
CREATE TABLE "driver_voucher_change_logs" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "field" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "driver_voucher_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "driver_voucher_change_logs_voucher_id_idx" ON "driver_voucher_change_logs"("voucher_id");
CREATE INDEX "driver_voucher_change_logs_changed_at_idx" ON "driver_voucher_change_logs"("changed_at");

ALTER TABLE "driver_voucher_change_logs" ADD CONSTRAINT "driver_voucher_change_logs_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "driver_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
