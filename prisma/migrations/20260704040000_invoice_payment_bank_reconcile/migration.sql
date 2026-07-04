-- Bank reconciliation flags on invoice payments
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "isReconciled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "reconciledAt" TIMESTAMP(3);
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "reconciledBy" UUID;

CREATE INDEX IF NOT EXISTS "invoice_payments_isReconciled_idx" ON "invoice_payments"("isReconciled");
