-- A1: manual payroll change audit (camelCase columns)

CREATE TABLE "payroll_change_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payrollMonthId" UUID,
    "payrollTripId" UUID,
    "payrollExtraId" UUID,
    "driverId" UUID NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "field" TEXT,
    "fromValue" TEXT,
    "toValue" TEXT,
    "metadata" JSONB,
    "changedBy" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_change_logs_driverId_yearMonth_idx" ON "payroll_change_logs"("driverId", "yearMonth");
CREATE INDEX "payroll_change_logs_changedAt_idx" ON "payroll_change_logs"("changedAt");

ALTER TABLE "payroll_change_logs" ADD CONSTRAINT "payroll_change_logs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
