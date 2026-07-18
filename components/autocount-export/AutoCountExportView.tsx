"use client";

import { useState } from "react";
import { ArInvoiceFreightExportPanel } from "@/components/ar-invoice-export/ArInvoiceFreightExportPanel";
import { ArInvoiceCrateReturnExportPanel } from "@/components/ar-invoice-export/ArInvoiceCrateReturnExportPanel";
import { ArInvoiceCharterExportPanel } from "@/components/ar-invoice-export/ArInvoiceCharterExportPanel";
import { CashBookPvAutocountExportPanel } from "@/components/autocount-export/CashBookPvAutocountExportPanel";
import { PayrollJvExportPanel } from "@/components/driver-payroll/PayrollJvExportPanel";
import { StaffPayrollJvExportPanel } from "@/components/staff-payroll/StaffPayrollJvExportPanel";
import { YearMonthFields } from "@/components/shared/YearMonthFields";

export function AutoCountExportView() {
  const now = new Date();
  const [jvYear, setJvYear] = useState(now.getFullYear());
  const [jvMonth, setJvMonth] = useState(now.getMonth() + 1);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          AutoCount 导出 Export
        </h2>
        <p className="mt-1 text-sm text-haidee-muted">
          集中导出 AR 销售发票、现金簿付款凭证与司机/员工薪资 JV，供 AutoCount 导入。
        </p>
      </div>

      <ArInvoiceFreightExportPanel />

      <ArInvoiceCrateReturnExportPanel />

      <ArInvoiceCharterExportPanel />

      <CashBookPvAutocountExportPanel />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <YearMonthFields
            year={jvYear}
            month={jvMonth}
            onYearChange={setJvYear}
            onMonthChange={setJvMonth}
          />
        </div>
        <PayrollJvExportPanel year={jvYear} month={jvMonth} isPending={false} />
        <StaffPayrollJvExportPanel
          year={jvYear}
          month={jvMonth}
          isPending={false}
        />
      </section>
    </div>
  );
}
