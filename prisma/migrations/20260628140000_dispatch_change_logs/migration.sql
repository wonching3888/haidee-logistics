-- A3/A4: dispatch & charter operation audit (camelCase columns)

CREATE TABLE "dispatch_change_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "entityLabel" TEXT,
    "eventType" TEXT NOT NULL,
    "field" TEXT,
    "fromValue" TEXT,
    "toValue" TEXT,
    "metadata" JSONB,
    "changedBy" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dispatch_change_logs_entityType_entityId_idx" ON "dispatch_change_logs"("entityType", "entityId");
CREATE INDEX "dispatch_change_logs_changedAt_idx" ON "dispatch_change_logs"("changedAt");
