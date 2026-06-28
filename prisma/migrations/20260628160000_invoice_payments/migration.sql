-- Invoice collections batch 2: customer payments + FIFO allocations (camelCase columns)

CREATE TABLE "invoice_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customerKey" TEXT NOT NULL,
    "customerKind" TEXT NOT NULL,
    "customerId" UUID,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "notes" TEXT,
    "allocationStrategy" TEXT NOT NULL DEFAULT 'auto',
    "unallocatedAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_payment_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paymentId" UUID NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "invoiceKey" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_payments_customerKey_currency_idx" ON "invoice_payments"("customerKey", "currency");
CREATE INDEX "invoice_payments_paymentDate_idx" ON "invoice_payments"("paymentDate");
CREATE INDEX "invoice_payments_bankAccount_idx" ON "invoice_payments"("bankAccount");

CREATE INDEX "invoice_payment_allocations_invoiceType_invoiceKey_idx" ON "invoice_payment_allocations"("invoiceType", "invoiceKey");
CREATE INDEX "invoice_payment_allocations_yearMonth_idx" ON "invoice_payment_allocations"("yearMonth");

CREATE UNIQUE INDEX "invoice_payment_allocations_paymentId_invoiceType_invoiceKey_key" ON "invoice_payment_allocations"("paymentId", "invoiceType", "invoiceKey");

ALTER TABLE "invoice_payment_allocations" ADD CONSTRAINT "invoice_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "invoice_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
