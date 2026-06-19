-- Partner freight module + logistics partner shipper kind (TAWAKAR).

ALTER TABLE "shippers" ADD COLUMN IF NOT EXISTS "shipper_kind" TEXT NOT NULL DEFAULT 'operational';

CREATE TABLE IF NOT EXISTS "partner_freight_rates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "crate_type" TEXT NOT NULL,
  "bill_to_shipper_id" UUID NOT NULL,
  "unit_rate_myr" DECIMAL(10, 2) NOT NULL,
  "tax_code" TEXT NOT NULL DEFAULT 'ESV-6',
  "tax_rate" DECIMAL(5, 4) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_freight_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "partner_freight_rates_crate_type_key" UNIQUE ("crate_type"),
  CONSTRAINT "partner_freight_rates_bill_to_shipper_id_fkey"
    FOREIGN KEY ("bill_to_shipper_id") REFERENCES "shippers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "partner_trip_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_no" TEXT NOT NULL,
  "trip_date" DATE NOT NULL,
  "truck_id" UUID NOT NULL,
  "market_id" UUID NOT NULL,
  "bill_to_shipper_id" UUID NOT NULL,
  "crate_type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_rate_myr" DECIMAL(10, 2) NOT NULL,
  "amount_myr" DECIMAL(10, 2) NOT NULL,
  "tax_code" TEXT NOT NULL,
  "tax_rate" DECIMAL(5, 4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_trip_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "partner_trip_invoices_invoice_no_key" UNIQUE ("invoice_no"),
  CONSTRAINT "partner_trip_invoices_trip_date_truck_id_market_id_crate_type_key"
    UNIQUE ("trip_date", "truck_id", "market_id", "crate_type"),
  CONSTRAINT "partner_trip_invoices_truck_id_fkey"
    FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "partner_trip_invoices_market_id_fkey"
    FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "partner_trip_invoices_bill_to_shipper_id_fkey"
    FOREIGN KEY ("bill_to_shipper_id") REFERENCES "shippers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "shippers" (
  "id",
  "code",
  "name",
  "pickup_location",
  "payment_party",
  "company",
  "currency",
  "shipper_kind",
  "active"
)
VALUES (
  gen_random_uuid(),
  '3000-T002',
  'TAWAKAR ENTERPRISE SDN BHD',
  'SADAO',
  'shipper',
  'wtl',
  'MYR',
  'logistics_partner',
  true
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "company" = EXCLUDED."company",
  "currency" = EXCLUDED."currency",
  "shipper_kind" = EXCLUDED."shipper_kind",
  "pickup_location" = EXCLUDED."pickup_location",
  "payment_party" = EXCLUDED."payment_party",
  "active" = EXCLUDED."active";

INSERT INTO "partner_freight_rates" (
  "crate_type",
  "bill_to_shipper_id",
  "unit_rate_myr",
  "tax_code",
  "tax_rate",
  "active"
)
SELECT
  'SKTN',
  s."id",
  1.50,
  'ESV-6',
  0,
  true
FROM "shippers" s
WHERE s."code" = '3000-T002'
ON CONFLICT ("crate_type") DO UPDATE SET
  "bill_to_shipper_id" = EXCLUDED."bill_to_shipper_id",
  "unit_rate_myr" = EXCLUDED."unit_rate_myr",
  "tax_code" = EXCLUDED."tax_code",
  "tax_rate" = EXCLUDED."tax_rate",
  "active" = EXCLUDED."active";
