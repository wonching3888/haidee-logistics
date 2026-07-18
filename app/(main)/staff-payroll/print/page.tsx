import { notFound } from "next/navigation";
import { getStaffPayslipPrintData } from "@/app/actions/staff-payroll";
import { StaffPayslipPrint } from "@/components/staff-payroll/StaffPayslipPrint";
import "@/components/driver-payroll/driver-payslip-print.css";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
import {
  isValidListMonth,
  isValidListYear,
} from "@/lib/parse-year-month-params";

export const dynamic = "force-dynamic";

interface StaffPayslipPrintPageProps {
  searchParams: Promise<{
    staffId?: string;
    year?: string;
    month?: string;
    returnTo?: string;
  }>;
}

export default async function StaffPayslipPrintPage({
  searchParams,
}: StaffPayslipPrintPageProps) {
  const params = await searchParams;
  const staffId = params.staffId?.trim() ?? "";
  const year = Number(params.year);
  const month = Number(params.month);
  const returnTo = params.returnTo?.trim() ?? "";

  if (!staffId || !isValidListYear(year) || !isValidListMonth(month)) {
    notFound();
  }

  try {
    const data = await getStaffPayslipPrintData({ staffId, year, month });
    if (!data) notFound();

    const documentTitle = `Payslip-${data.staff.name}-${data.yearMonth}`;
    const backHref =
      returnTo ||
      `/staff-payroll?staffId=${encodeURIComponent(staffId)}&year=${year}&month=${month}`;

    return (
      <DOPrintPageWithShare
        title={`工资单 PAYSLIP — ${data.staff.name} · ${data.yearMonth}`}
        documentTitle={documentTitle}
        backHref={backHref}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `Payslip ${data.staff.name} · ${data.yearMonth}`,
        }}
      >
        <StaffPayslipPrint
          year={data.year}
          month={data.month}
          staff={data.staff}
          summary={data.summary}
        />
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">工资单 PAYSLIP</h2>
        <PageError error={error} />
      </div>
    );
  }
}
