-- CreateTable: per-market voucher actual drafts (parking / kpb / unload)
CREATE TABLE "driver_voucher_market_actuals" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "fee_type" TEXT NOT NULL,
    "display_market" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_voucher_market_actuals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_voucher_market_actuals_voucher_id_fee_type_display_market_key" ON "driver_voucher_market_actuals"("voucher_id", "fee_type", "display_market");

-- CreateIndex
CREATE INDEX "driver_voucher_market_actuals_voucher_id_idx" ON "driver_voucher_market_actuals"("voucher_id");

-- AddForeignKey
ALTER TABLE "driver_voucher_market_actuals" ADD CONSTRAINT "driver_voucher_market_actuals_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "driver_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
