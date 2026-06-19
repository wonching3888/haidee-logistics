"use client";

import { useCallback, useState } from "react";
import type { PartnerTripInvoicePrintData } from "@/lib/partner-freight";
import { DOPrintPageLayout } from "@/components/documents/DOPrintPageLayout";
import { PartnerTripInvoicePrint } from "@/components/documents/PartnerTripInvoicePrint";
import { PrintPdfSharePrototype } from "@/components/documents/PrintPdfSharePrototype";

interface PartnerTripInvoicePrintClientProps {
  data: PartnerTripInvoicePrintData;
  backHref?: string;
}

export function PartnerTripInvoicePrintClient({
  data,
  backHref,
}: PartnerTripInvoicePrintClientProps) {
  const [printContentEl, setPrintContentEl] = useState<HTMLDivElement | null>(
    null
  );

  const handlePrintContentMount = useCallback((element: HTMLDivElement | null) => {
    setPrintContentEl(element);
  }, []);

  const shareText = [
    `Partner Trip Invoice ${data.invoiceNo}`,
    `${data.billToName} · ${data.truckPlate} · ${data.marketLabel}`,
    `Qty ${data.quantity} × ${data.unitRateMyr.toFixed(2)} = ${data.totalMyr.toFixed(2)} ${data.currency}`,
  ].join("\n");

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        PDF 分享验证原型（仅本页）：点击「分享 PDF」会在前端把下方单据转成真实 PDF
        文件，并尝试调起系统分享面板（iOS/Android 可选 WhatsApp）。「打印」按钮与
        其他打印页相同，不会触发分享逻辑。
      </p>

      <DOPrintPageLayout
        title={`Partner Trip Invoice — ${data.invoiceNo}`}
        documentTitle={data.invoiceNo}
        backHref={backHref}
        onPrintContentMount={handlePrintContentMount}
        toolbarExtra={
          <PrintPdfSharePrototype
            getContentElement={() => printContentEl}
            payload={{
              fileName: `${data.invoiceNo}.pdf`,
              title: data.invoiceNo,
              text: shareText,
            }}
          />
        }
      >
        <PartnerTripInvoicePrint data={data} />
      </DOPrintPageLayout>
    </div>
  );
}
