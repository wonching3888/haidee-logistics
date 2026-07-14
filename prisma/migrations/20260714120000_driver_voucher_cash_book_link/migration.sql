-- Link driver expense vouchers to the MYR Cash Book Payment Voucher
-- created on Duit Jalan advance (replaced in-place on settlement).

ALTER TABLE "driver_vouchers"
ADD COLUMN "cash_book_payment_voucher_id" UUID;

CREATE UNIQUE INDEX "driver_vouchers_cash_book_payment_voucher_id_key"
ON "driver_vouchers"("cash_book_payment_voucher_id");

ALTER TABLE "driver_vouchers"
ADD CONSTRAINT "driver_vouchers_cash_book_payment_voucher_id_fkey"
FOREIGN KEY ("cash_book_payment_voucher_id")
REFERENCES "cash_book_payment_vouchers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
