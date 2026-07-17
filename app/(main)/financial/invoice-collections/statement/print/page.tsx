import { getDebtorStatementPrintData } from "@/app/actions/debtor-statement";
import { DebtorStatementPrint } from "@/components/documents/DebtorStatementPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";

export const dynamic = "force-dynamic";

interface DebtorStatementPrintPageProps {
  searchParams: Promise<{
    customerKey?: string;
    currency?: string;
    fromYear?: string;
    fromMonth?: string;
    toYear?: string;
    toMonth?: string;
  }>;
}

function buildBackHref(input: {
  customerKey: string;
  currency: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
}) {
  const params = new URLSearchParams();
  params.set("fromYear", String(input.fromYear));
  params.set("fromMonth", String(input.fromMonth));
  params.set("toYear", String(input.toYear));
  params.set("toMonth", String(input.toMonth));
  params.set("customerKey", input.customerKey);
  params.set("currency", input.currency);
  params.set("q", "1");
  return `/financial/invoice-collections?${params.toString()}`;
}

export default async function DebtorStatementPrintPage({
  searchParams,
}: DebtorStatementPrintPageProps) {
  const params = await searchParams;
  const customerKey = params.customerKey?.trim() ?? "";
  const currency = params.currency?.trim() ?? "";
  const fromYear = parseReportYear(params.fromYear);
  const fromMonth = parseReportMonth(params.fromMonth);
  const toYear = parseReportYear(params.toYear);
  const toMonth = parseReportMonth(params.toMonth);

  if (!customerKey || !currency) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          客户对账单 Statement of Account
        </h2>
        <PageError error={new Error("缺少客户或币种 Missing customerKey / currency")} />
      </div>
    );
  }

  try {
    const data = await getDebtorStatementPrintData({
      customerKey,
      currency,
      fromYear,
      fromMonth,
      toYear,
      toMonth,
    });
    const documentTitle = `Debtor-Statement-${data.currency}-${customerKey.replace(/[^a-zA-Z0-9_-]+/g, "_")}`;

    return (
      <DOPrintPageWithShare
        title={`客户对账单 · ${data.customerName}`}
        documentTitle={documentTitle}
        backHref={buildBackHref({
          customerKey,
          currency,
          fromYear,
          fromMonth,
          toYear,
          toMonth,
        })}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `Statement of Account · ${data.customerName} · ${data.periodLabel}`,
        }}
      >
        <DebtorStatementPrint data={data} />
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          客户对账单 Statement of Account
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
