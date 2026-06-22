"use client";

import type { CharterInvoiceData } from "@/lib/charter-invoice";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { CharterHaideeInvoicePrint } from "@/components/charter/CharterHaideeInvoicePrint";
import { CharterWtlInvoicePrint } from "@/components/charter/CharterWtlInvoicePrint";
import "@/components/documents/document-print.css";

interface CharterInvoicePrintClientProps {
  data: CharterInvoiceData;
  backHref: string;
}

export function CharterInvoicePrintClient({
  data,
  backHref,
}: CharterInvoicePrintClientProps) {
  const shareText = [
    `Charter Invoice ${data.charterNo}`,
    `${data.billTo.name} · ${data.truckPlate}`,
    `Total ${data.grandTotalMyr.toFixed(2)} ${data.currency}`,
  ].join("\n");

  return (
    <DOPrintPageWithShare
      title={`Charter Invoice — ${data.charterNo}`}
      documentTitle={data.charterNo}
      backHref={backHref}
      sharePayload={{
        fileName: `${data.charterNo}.pdf`,
        title: data.charterNo,
        text: shareText,
      }}
    >
      {data.billingCompany === "wtl" ? (
        <CharterWtlInvoicePrint data={data} />
      ) : (
        <CharterHaideeInvoicePrint data={data} />
      )}
    </DOPrintPageWithShare>
  );
}
