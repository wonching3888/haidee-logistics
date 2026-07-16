-- Cash Book Receipt Voucher lines (1:1 backfill from header fields; headers untouched)

CREATE TABLE "cash_book_receipt_voucher_lines" (
    "id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "line_order" INTEGER NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "particulars" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "cash_book_receipt_voucher_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cash_book_receipt_voucher_lines_voucher_id_idx"
  ON "cash_book_receipt_voucher_lines"("voucher_id");

CREATE UNIQUE INDEX "cash_book_receipt_voucher_lines_voucher_id_line_order_key"
  ON "cash_book_receipt_voucher_lines"("voucher_id", "line_order");

ALTER TABLE "cash_book_receipt_voucher_lines"
  ADD CONSTRAINT "cash_book_receipt_voucher_lines_voucher_id_fkey"
  FOREIGN KEY ("voucher_id") REFERENCES "cash_book_receipt_vouchers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one line per existing RV; copy header fields as-is (no UPDATE on headers)
INSERT INTO "cash_book_receipt_voucher_lines"
  ("id", "voucher_id", "line_order", "account_code", "account_name", "particulars", "amount")
SELECT
  gen_random_uuid(),
  "id",
  1,
  "account_code",
  "account_name",
  "notes",
  "amount"
FROM "cash_book_receipt_vouchers";
