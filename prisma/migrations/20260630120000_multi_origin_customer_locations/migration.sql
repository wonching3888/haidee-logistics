-- Multi-origin customer: standard Thai origin list per shipper + inbound selection field.

ALTER TABLE "shippers"
ADD COLUMN "is_multi_origin_customer" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "customer_origin_locations" (
    "id" UUID NOT NULL,
    "shipper_id" UUID NOT NULL,
    "location_name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_origin_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_origin_locations_shipper_id_location_name_key"
ON "customer_origin_locations"("shipper_id", "location_name");

CREATE INDEX "customer_origin_locations_shipper_id_idx"
ON "customer_origin_locations"("shipper_id");

ALTER TABLE "customer_origin_locations"
ADD CONSTRAINT "customer_origin_locations_shipper_id_fkey"
FOREIGN KEY ("shipper_id") REFERENCES "shippers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inbound_sessions"
ADD COLUMN "customer_origin_location" TEXT;
