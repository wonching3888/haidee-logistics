-- Crate return monthly billing (customer-owned empty crates, HAIDEE).
-- Independent from partner_freight_rates / partner_trip_invoices (TAWAKAR SKTN)
-- and from inbound monthly invoice Modes 1-4.

CREATE TABLE IF NOT EXISTS "crate_return_freight_rates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "crate_type" TEXT NOT NULL,
  "bill_to_shipper_id" UUID NOT NULL,
  "freight_rate_myr" DECIMAL(10, 2) NOT NULL,
  "collection_rate_myr" DECIMAL(10, 2) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crate_return_freight_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crate_return_freight_rates_crate_type_key" UNIQUE ("crate_type"),
  CONSTRAINT "crate_return_freight_rates_bill_to_shipper_id_fkey"
    FOREIGN KEY ("bill_to_shipper_id") REFERENCES "shippers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "crate_return_monthly_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_no" TEXT NOT NULL,
  "year_month" TEXT NOT NULL,
  "bill_to_shipper_id" UUID NOT NULL,
  "crate_type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "freight_rate_myr" DECIMAL(10, 2) NOT NULL,
  "collection_rate_myr" DECIMAL(10, 2) NOT NULL,
  "freight_amount_myr" DECIMAL(10, 2) NOT NULL,
  "collection_amount_myr" DECIMAL(10, 2) NOT NULL,
  "total_amount_myr" DECIMAL(10, 2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crate_return_monthly_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crate_return_monthly_invoices_invoice_no_key" UNIQUE ("invoice_no"),
  CONSTRAINT "crate_return_monthly_invoices_year_month_bill_to_shipper_id_crate_type_key"
    UNIQUE ("year_month", "bill_to_shipper_id", "crate_type"),
  CONSTRAINT "crate_return_monthly_invoices_bill_to_shipper_id_fkey"
    FOREIGN KEY ("bill_to_shipper_id") REFERENCES "shippers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "crate_return_monthly_invoice_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "market_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "freight_amount_myr" DECIMAL(10, 2) NOT NULL,
  "collection_amount_myr" DECIMAL(10, 2) NOT NULL,
  CONSTRAINT "crate_return_monthly_invoice_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crate_return_monthly_invoice_lines_invoice_id_market_id_key"
    UNIQUE ("invoice_id", "market_id"),
  CONSTRAINT "crate_return_monthly_invoice_lines_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "crate_return_monthly_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "crate_return_monthly_invoice_lines_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Seed GKS → Sakda Pattani (3002-S006).
INSERT INTO "crate_return_freight_rates" (
  "crate_type",
  "bill_to_shipper_id",
  "freight_rate_myr",
  "collection_rate_myr",
  "active"
)
SELECT
  'GKS',
  s."id",
  3.00,
  1.50,
  true
FROM "shippers" s
WHERE s."code" = '3002-S006'
ON CONFLICT ("crate_type") DO UPDATE SET
  "bill_to_shipper_id" = EXCLUDED."bill_to_shipper_id",
  "freight_rate_myr" = EXCLUDED."freight_rate_myr",
  "collection_rate_myr" = EXCLUDED."collection_rate_myr",
  "active" = EXCLUDED."active";

-- GLY → Epic Glory (EPIC GLORY SDN BHD): add after B1-0 shipper master data exists.
-- Planned: freight_rate_myr=1.50, collection_rate_myr=0.00
-- INSERT INTO "crate_return_freight_rates" (...) SELECT 'GLY', s."id", 1.50, 0.00, true
-- FROM "shippers" s WHERE s."code" = '<EPIC_GLORY_AUTOCOUNT_CODE>' ...
