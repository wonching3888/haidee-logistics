-- Allow no-return crate imports without a source market (no loading at any market).
ALTER TABLE "tong_imports" ALTER COLUMN "market_id" DROP NOT NULL;
