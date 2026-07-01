-- AlterTable
ALTER TABLE "monthly_invoice_extra_charges"
ADD COLUMN "quantity" DECIMAL(10,2),
ADD COLUMN "unit" TEXT,
ADD COLUMN "unit_price" DECIMAL(10,2);
