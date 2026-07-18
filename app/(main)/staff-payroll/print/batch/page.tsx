import { notFound } from "next/navigation";
import { getBatchStaffPayslipPrintData } from "@/app/actions/staff-payroll";
import { StaffPayslipBatchPrint } from "@/components/staff-payroll/StaffPayslipBatchPrint";
import "@/components/driver-payroll/driver-payslip-print.css";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
import {
  isValidListMonth,
  isValidListYear,
} from "@/lib/parse-year-month-params";

export const dynamic = "force-dynamic";

interface StaffPayslipBatchPrintPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    returnTo?: string;
  }>;
}

export default async function StaffPayslipBatchPrintPage({
  searchParams,
}: StaffPayslipBatchPrintPageProps) {
  const params = await searchParams;
  const year = Number(params.year);
  const month = Number(params.month);
  const returnTo = params.returnTo?.trim() ?? "";

  if (!isValidListYear(year) || !isValidListMonth(month)) {
    notFound();
  }

  try {
    const data = await getBatchStaffPayslipPrintData({ year, month });
    if (data.entries.length === 0) notFound();

    const documentTitle = `Payslip-Staff-Batch-${data.yearMonth}`;
    const backHref =
      returnTo || `/staff-payroll?year=${year}&month=${month}`;

    return (
      <DOPrintPageWithShare
        title={`批量工资单 Batch PAYSLIP — ${data.yearMonth} (${data.entries.length} 人)`}
        documentTitle={documentTitle}
        backHref={backHref}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `Batch staff payslip ${data.yearMonth} · ${data.entries.length} staff`,
        }}
        sectionSelector=".driver-payslip-batch-page"
      >
        <StaffPayslipBatchPrint
          year={data.year}
          month={data.month}
          entries={data.entries}
        />
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          批量工资单 Batch PAYSLIP
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
