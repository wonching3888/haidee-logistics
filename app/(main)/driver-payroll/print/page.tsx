import { notFound } from "next/navigation";
import { getDriverPayslipPrintData } from "@/app/actions/driver-payroll";
import { DriverPayslipPrint } from "@/components/driver-payroll/DriverPayslipPrint";
import "@/components/driver-payroll/driver-payslip-print.css";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
import {
  isValidListMonth,
  isValidListYear,
} from "@/lib/parse-year-month-params";

export const dynamic = "force-dynamic";

interface DriverPayslipPrintPageProps {
  searchParams: Promise<{
    driverId?: string;
    year?: string;
    month?: string;
    returnTo?: string;
  }>;
}

export default async function DriverPayslipPrintPage({
  searchParams,
}: DriverPayslipPrintPageProps) {
  const params = await searchParams;
  const driverId = params.driverId?.trim() ?? "";
  const year = Number(params.year);
  const month = Number(params.month);
  const returnTo = params.returnTo?.trim() ?? "";

  if (!driverId || !isValidListYear(year) || !isValidListMonth(month)) {
    notFound();
  }

  try {
    const data = await getDriverPayslipPrintData({ driverId, year, month });
    if (!data) notFound();

    const documentTitle = `Payslip-${data.driver.name}-${data.yearMonth}`;
    const backHref =
      returnTo ||
      `/driver-payroll?driverId=${encodeURIComponent(driverId)}&year=${year}&month=${month}`;

    return (
      <DOPrintPageWithShare
        title={`工资单 PAYSLIP — ${data.driver.payrollName} · ${data.yearMonth}`}
        documentTitle={documentTitle}
        backHref={backHref}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `Payslip ${data.driver.payrollName} · ${data.yearMonth}`,
        }}
      >
        <DriverPayslipPrint
          year={data.year}
          month={data.month}
          driver={data.driver}
          summary={data.summary}
          advances={data.advances}
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
