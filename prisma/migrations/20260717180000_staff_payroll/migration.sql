-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "full_name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "termination_date" DATE,
    "base_salary" DECIMAL(10,2),
    "autocount_employee_code" TEXT,
    "ic_number" TEXT,
    "epf_number" TEXT,
    "socso_number" TEXT,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "marital_status" TEXT,
    "spouse_working" BOOLEAN,
    "pcb_needs_review" BOOLEAN NOT NULL DEFAULT true,
    "child_count" INTEGER NOT NULL DEFAULT 0,
    "account_code_suffix" TEXT,
    "is_socso_second_category" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_pcb_ytd_balances" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "as_of_year_month" TEXT NOT NULL,
    "accumulated_gross_y" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "accumulated_epf_k" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "accumulated_mtd_x" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "accumulated_zakat_z" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pcb_ytd_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_payroll_months" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "year_month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "epf_employee_override" DECIMAL(10,2),
    "epf_employer_override" DECIMAL(10,2),
    "socso_employee_override" DECIMAL(10,2),
    "socso_employer_override" DECIMAL(10,2),
    "eis_employee_override" DECIMAL(10,2),
    "eis_employer_override" DECIMAL(10,2),
    "pcb_override" DECIMAL(10,2),
    "lindung_24_jam_override" DECIMAL(10,2),
    "pcb_computed" DECIMAL(10,2),
    "pcb_final" DECIMAL(10,2),
    "pcb_locked" BOOLEAN NOT NULL DEFAULT false,
    "pcb_locked_at" TIMESTAMP(3),
    "pcb_snapshot_ytd_gross" DECIMAL(12,2),
    "pcb_snapshot_ytd_epf" DECIMAL(12,2),
    "pcb_snapshot_ytd_mtd" DECIMAL(12,2),
    "pcb_snapshot_month_gross" DECIMAL(12,2),
    "pcb_snapshot_month_epf" DECIMAL(12,2),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_payroll_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_payroll_change_logs" (
    "id" UUID NOT NULL,
    "payrollMonthId" UUID,
    "staffId" UUID NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "field" TEXT,
    "fromValue" TEXT,
    "toValue" TEXT,
    "metadata" JSONB,
    "changedBy" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_payroll_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_name_key" ON "staff"("name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_ic_number_key" ON "staff"("ic_number");

-- CreateIndex
CREATE UNIQUE INDEX "staff_pcb_ytd_balances_staff_id_as_of_year_month_key" ON "staff_pcb_ytd_balances"("staff_id", "as_of_year_month");

-- CreateIndex
CREATE INDEX "staff_pcb_ytd_balances_as_of_year_month_idx" ON "staff_pcb_ytd_balances"("as_of_year_month");

-- CreateIndex
CREATE UNIQUE INDEX "staff_payroll_months_staff_id_year_month_key" ON "staff_payroll_months"("staff_id", "year_month");

-- CreateIndex
CREATE INDEX "staff_payroll_change_logs_staffId_yearMonth_idx" ON "staff_payroll_change_logs"("staffId", "yearMonth");

-- CreateIndex
CREATE INDEX "staff_payroll_change_logs_changedAt_idx" ON "staff_payroll_change_logs"("changedAt");

-- AddForeignKey
ALTER TABLE "staff_pcb_ytd_balances" ADD CONSTRAINT "staff_pcb_ytd_balances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_payroll_months" ADD CONSTRAINT "staff_payroll_months_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_payroll_change_logs" ADD CONSTRAINT "staff_payroll_change_logs_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
