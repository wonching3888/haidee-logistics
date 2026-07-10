-- Cash Book Payment Voucher (entry + print only; no ledger posting yet)

CREATE TABLE "cash_book_payment_vouchers" (
    "id" UUID NOT NULL,
    "voucher_no" TEXT NOT NULL,
    "book" TEXT NOT NULL,
    "voucher_date" DATE NOT NULL,
    "paid_to" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "check_no" TEXT,
    "check_date" DATE,
    "due_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" UUID,
    "payee_signature" TEXT,
    "prepared_by" TEXT,
    "approved_by" TEXT,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_book_payment_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_book_payment_voucher_lines" (
    "id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "line_order" INTEGER NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "particulars" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "cash_book_payment_voucher_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cash_book_payment_vouchers_voucher_no_key" ON "cash_book_payment_vouchers"("voucher_no");
CREATE INDEX "cash_book_payment_vouchers_voucher_date_idx" ON "cash_book_payment_vouchers"("voucher_date");
CREATE INDEX "cash_book_payment_vouchers_book_idx" ON "cash_book_payment_vouchers"("book");
CREATE INDEX "cash_book_payment_vouchers_status_idx" ON "cash_book_payment_vouchers"("status");
CREATE INDEX "cash_book_payment_voucher_lines_voucher_id_idx" ON "cash_book_payment_voucher_lines"("voucher_id");

ALTER TABLE "cash_book_payment_voucher_lines" ADD CONSTRAINT "cash_book_payment_voucher_lines_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "cash_book_payment_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
