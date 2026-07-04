-- Pattani handling + rates (no holiday/OT). Extend monthly rate snapshots.

CREATE TABLE "pattani_crate_handling_daily" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "crate_qty" INTEGER NOT NULL,
    "box_qty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pattani_crate_handling_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pattani_crate_handling_daily_date_key" ON "pattani_crate_handling_daily"("date");

INSERT INTO "thai_cost_rate_settings" ("id", "key", "value", "updated_at") VALUES
(gen_random_uuid(), 'pattani_contractor_crate', 20, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'pattani_contractor_box', 5, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'pattani_sakri_crate', 2.2, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

ALTER TABLE "thai_cost_monthly_rate_snapshots"
  ADD COLUMN "pattani_contractor_crate" DECIMAL(12,4) NOT NULL DEFAULT 20,
  ADD COLUMN "pattani_contractor_box" DECIMAL(12,4) NOT NULL DEFAULT 5,
  ADD COLUMN "pattani_sakri_crate" DECIMAL(12,4) NOT NULL DEFAULT 2.2;
