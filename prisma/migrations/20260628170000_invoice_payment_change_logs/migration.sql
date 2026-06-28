-- Invoice payment manual action audit (camelCase columns)

CREATE TABLE "invoice_payment_change_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paymentId" UUID,
    "customerKey" TEXT,
    "currency" TEXT,
    "eventType" TEXT NOT NULL,
    "field" TEXT,
    "fromValue" TEXT,
    "toValue" TEXT,
    "metadata" JSONB,
    "changedBy" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payment_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_payment_change_logs_paymentId_idx" ON "invoice_payment_change_logs"("paymentId");
CREATE INDEX "invoice_payment_change_logs_changedAt_idx" ON "invoice_payment_change_logs"("changedAt");
CREATE INDEX "invoice_payment_change_logs_customerKey_currency_idx" ON "invoice_payment_change_logs"("customerKey", "currency");
