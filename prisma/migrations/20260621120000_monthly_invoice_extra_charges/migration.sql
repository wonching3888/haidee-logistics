-- CreateTable
CREATE TABLE "monthly_invoice_extra_charges" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_invoice_extra_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_invoice_extra_charges_year_month_mode_customer_id_idx" ON "monthly_invoice_extra_charges"("year", "month", "mode", "customer_id");
