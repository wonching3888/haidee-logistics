-- Link Thai handling / driver-trip daily rows to THB Cash Book Payment Vouchers.

ALTER TABLE "sadao_crate_handling_daily"
ADD COLUMN "cash_book_payment_voucher_id" UUID;

CREATE UNIQUE INDEX "sadao_crate_handling_daily_cash_book_payment_voucher_id_key"
ON "sadao_crate_handling_daily"("cash_book_payment_voucher_id");

ALTER TABLE "sadao_crate_handling_daily"
ADD CONSTRAINT "sadao_crate_handling_daily_cash_book_payment_voucher_id_fkey"
FOREIGN KEY ("cash_book_payment_voucher_id")
REFERENCES "cash_book_payment_vouchers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "songkhla_crate_handling_daily"
ADD COLUMN "cash_book_payment_voucher_id" UUID;

CREATE UNIQUE INDEX "songkhla_crate_handling_daily_cash_book_payment_voucher_id_key"
ON "songkhla_crate_handling_daily"("cash_book_payment_voucher_id");

ALTER TABLE "songkhla_crate_handling_daily"
ADD CONSTRAINT "songkhla_crate_handling_daily_cash_book_payment_voucher_id_fkey"
FOREIGN KEY ("cash_book_payment_voucher_id")
REFERENCES "cash_book_payment_vouchers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pattani_crate_handling_daily"
ADD COLUMN "cash_book_payment_voucher_id" UUID;

CREATE UNIQUE INDEX "pattani_crate_handling_daily_cash_book_payment_voucher_id_key"
ON "pattani_crate_handling_daily"("cash_book_payment_voucher_id");

ALTER TABLE "pattani_crate_handling_daily"
ADD CONSTRAINT "pattani_crate_handling_daily_cash_book_payment_voucher_id_fkey"
FOREIGN KEY ("cash_book_payment_voucher_id")
REFERENCES "cash_book_payment_vouchers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "thai_driver_trip_daily"
ADD COLUMN "cash_book_payment_voucher_id" UUID;

CREATE UNIQUE INDEX "thai_driver_trip_daily_cash_book_payment_voucher_id_key"
ON "thai_driver_trip_daily"("cash_book_payment_voucher_id");

ALTER TABLE "thai_driver_trip_daily"
ADD CONSTRAINT "thai_driver_trip_daily_cash_book_payment_voucher_id_fkey"
FOREIGN KEY ("cash_book_payment_voucher_id")
REFERENCES "cash_book_payment_vouchers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
