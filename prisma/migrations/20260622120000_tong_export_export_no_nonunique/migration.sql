-- Allow multiple tong_exports rows per export_no (one batch, many crate types).
DROP INDEX IF EXISTS "tong_exports_export_no_key";
CREATE INDEX IF NOT EXISTS "tong_exports_export_no_idx" ON "tong_exports" ("export_no");
