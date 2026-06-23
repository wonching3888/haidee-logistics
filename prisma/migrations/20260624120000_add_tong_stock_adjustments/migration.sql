-- CreateTable
CREATE TABLE "tong_stock_adjustments" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "tong_type_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance_after" INTEGER,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tong_stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tong_stock_adjustments_tong_type_id_idx" ON "tong_stock_adjustments"("tong_type_id");

-- CreateIndex
CREATE INDEX "tong_stock_adjustments_date_idx" ON "tong_stock_adjustments"("date");

-- AddForeignKey
ALTER TABLE "tong_stock_adjustments" ADD CONSTRAINT "tong_stock_adjustments_tong_type_id_fkey" FOREIGN KEY ("tong_type_id") REFERENCES "tong_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tong_stock_adjustments" ADD CONSTRAINT "tong_stock_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
