CREATE TABLE IF NOT EXISTS "crate_export_mismatch_whitelist" (
    "shipper_id" UUID NOT NULL,
    "note" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "crate_export_mismatch_whitelist_pkey" PRIMARY KEY ("shipper_id")
);

DO $$ BEGIN
    ALTER TABLE "crate_export_mismatch_whitelist" ADD CONSTRAINT "crate_export_mismatch_whitelist_shipper_id_fkey" FOREIGN KEY ("shipper_id") REFERENCES "shippers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
