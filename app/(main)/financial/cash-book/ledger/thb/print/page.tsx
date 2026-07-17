import { getCashBookLedgerStatement } from "@/app/actions/cash-book-ledger-statement";
import { CashBookLedgerStatementPrint } from "@/components/cash-book/CashBookLedgerStatementPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";

export const dynamic = "force-dynamic";

interface ThbCashBookLedgerPrintPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
  }>;
}

export default async function ThbCashBookLedgerPrintPage({
  searchParams,
}: ThbCashBookLedgerPrintPageProps) {
  const params = await searchParams;
  const year = parseReportYear(params.year);
  const month = parseReportMonth(params.month);

  try {
    const data = await getCashBookLedgerStatement({
      book: "THB",
      year,
      month,
    });
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const documentTitle = `Cash-Book-Ledger-THB-${ym}`;

    return (
      <DOPrintPageWithShare
        title={`THB 账本明细 · ${ym}`}
        documentTitle={documentTitle}
        backHref="/financial/cash-book/ledger/thb"
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `THB Cash Book Ledger · ${ym}`,
        }}
      >
        <CashBookLedgerStatementPrint data={data} />
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          THB 账本明细 Cash Book Ledger
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
