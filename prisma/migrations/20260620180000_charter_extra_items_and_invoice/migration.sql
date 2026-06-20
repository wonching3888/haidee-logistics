-- CreateTable: charter_trip_extra_items
CREATE TABLE "charter_trip_extra_items" (
    "id" UUID NOT NULL,
    "charter_trip_id" UUID NOT NULL,
    "item_type" TEXT NOT NULL,
    "amount_myr" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "charter_trip_extra_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "charter_trip_extra_items_charter_trip_id_idx" ON "charter_trip_extra_items"("charter_trip_id");

ALTER TABLE "charter_trip_extra_items" ADD CONSTRAINT "charter_trip_extra_items_charter_trip_id_fkey" FOREIGN KEY ("charter_trip_id") REFERENCES "charter_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add invoice / bill-to columns on charter_trips
ALTER TABLE "charter_trips" ADD COLUMN "billing_company" TEXT NOT NULL DEFAULT 'haidee';
ALTER TABLE "charter_trips" ADD COLUMN "bill_to_customer_name" TEXT;

-- Migrate legacy single extra-revenue row → extra_items (revenue)
INSERT INTO "charter_trip_extra_items" ("id", "charter_trip_id", "item_type", "amount_myr", "note", "sort_order")
SELECT gen_random_uuid(), "id", 'revenue', "charter_extra_revenue_myr", "charter_extra_revenue_note", 0
FROM "charter_trips"
WHERE "charter_extra_revenue_myr" IS NOT NULL AND "charter_extra_revenue_myr" <> 0;

-- Migrate legacy single extra-cost row → extra_items (cost)
INSERT INTO "charter_trip_extra_items" ("id", "charter_trip_id", "item_type", "amount_myr", "note", "sort_order")
SELECT gen_random_uuid(), "id", 'cost', "charter_extra_cost_myr", "charter_extra_cost_note", 1
FROM "charter_trips"
WHERE "charter_extra_cost_myr" IS NOT NULL AND "charter_extra_cost_myr" <> 0;

-- Drop legacy scalar extra fields
ALTER TABLE "charter_trips" DROP COLUMN "charter_extra_revenue_myr";
ALTER TABLE "charter_trips" DROP COLUMN "charter_extra_revenue_note";
ALTER TABLE "charter_trips" DROP COLUMN "charter_extra_cost_myr";
ALTER TABLE "charter_trips" DROP COLUMN "charter_extra_cost_note";

-- Allow general cargo to optionally link shipper (was seafood-only in app logic; column already nullable)
-- No schema change needed for shipper_id — application layer only.
