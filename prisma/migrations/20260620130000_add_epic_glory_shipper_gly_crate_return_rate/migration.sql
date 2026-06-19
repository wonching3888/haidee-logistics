-- B1-0: Epic Glory shipper + GLY crate return freight rate.

INSERT INTO "shippers" (
  "id",
  "code",
  "name",
  "location",
  "pickup_location",
  "payment_party",
  "company",
  "currency",
  "shipper_kind",
  "active"
)
VALUES (
  gen_random_uuid(),
  '3002-E001',
  'EPIC GLORY SDN BHD',
  E'3A, 1ST FLOOR, JALAN TUANKU HAMINAH 1,\nTAMAN TUANKU HAMINAH,\n08000 SUNGAI PETANI, KEDAH.',
  'SADAO',
  'shipper',
  'haidee',
  'MYR',
  'operational',
  true
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "location" = EXCLUDED."location",
  "pickup_location" = EXCLUDED."pickup_location",
  "payment_party" = EXCLUDED."payment_party",
  "company" = EXCLUDED."company",
  "currency" = EXCLUDED."currency",
  "shipper_kind" = EXCLUDED."shipper_kind",
  "active" = EXCLUDED."active";

INSERT INTO "crate_return_freight_rates" (
  "crate_type",
  "bill_to_shipper_id",
  "freight_rate_myr",
  "collection_rate_myr",
  "active"
)
SELECT
  'GLY',
  s."id",
  1.50,
  0.00,
  true
FROM "shippers" s
WHERE s."code" = '3002-E001'
ON CONFLICT ("crate_type") DO UPDATE SET
  "bill_to_shipper_id" = EXCLUDED."bill_to_shipper_id",
  "freight_rate_myr" = EXCLUDED."freight_rate_myr",
  "collection_rate_myr" = EXCLUDED."collection_rate_myr",
  "active" = EXCLUDED."active";
