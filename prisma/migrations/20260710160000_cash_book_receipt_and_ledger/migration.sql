-- Cash Book Receipt Voucher + opening-balance adjustments (ledger posting from confirmed vouchers only)

CREATE TABLE "cash_book_receipt_vouchers" (
    "id" UUID NOT NULL,
    "voucher_no" TEXT NOT NULL,
    "book" TEXT NOT NULL,
    "voucher_date" DATE NOT NULL,
    "received_from" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" UUID,
    "prepared_by" TEXT,
    "approved_by" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_book_receipt_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cash_book_receipt_vouchers_voucher_no_key" ON "cash_book_receipt_vouchers"("voucher_no");
CREATE INDEX "cash_book_receipt_vouchers_voucher_date_idx" ON "cash_book_receipt_vouchers"("voucher_date");
CREATE INDEX "cash_book_receipt_vouchers_book_idx" ON "cash_book_receipt_vouchers"("book");
CREATE INDEX "cash_book_receipt_vouchers_status_idx" ON "cash_book_receipt_vouchers"("status");

CREATE TABLE "cash_book_opening_balance_adjustments" (
    "id" UUID NOT NULL,
    "book" TEXT NOT NULL,
    "previous_amount" DECIMAL(14,2) NOT NULL,
    "new_amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_book_opening_balance_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cash_book_opening_balance_adjustments_book_created_at_idx"
  ON "cash_book_opening_balance_adjustments"("book", "created_at");
