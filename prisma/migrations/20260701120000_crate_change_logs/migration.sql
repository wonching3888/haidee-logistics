-- Crate management manual-operation audit trail

CREATE TABLE "crate_change_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" TEXT NOT NULL,
    "shipperId" UUID,
    "shipperName" TEXT,
    "crateType" TEXT,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "metadata" JSONB,
    "summary" TEXT NOT NULL,
    "changedById" UUID NOT NULL,
    "changedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crate_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crate_change_logs_action_idx" ON "crate_change_logs"("action");
CREATE INDEX "crate_change_logs_shipperId_idx" ON "crate_change_logs"("shipperId");
CREATE INDEX "crate_change_logs_createdAt_idx" ON "crate_change_logs"("createdAt");
