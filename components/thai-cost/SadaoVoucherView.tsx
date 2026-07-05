"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import { useT } from "@/components/shared/locale-context";
import { SADAO_VOUCHER_PRINT } from "@/lib/constants/thai-cost-print";
import type { SadaoVoucherDetail } from "@/lib/thai-cost/sadao-voucher";
import { formatDisplay } from "@/lib/date-utils";
import "@/components/documents/document-print.css";

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function SadaoVoucherView({
  voucher,
  canPrint,
}: {
  voucher: SadaoVoucherDetail;
  canPrint: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const { tLocal } = useT();
  const P = SADAO_VOUCHER_PRINT;

  function handlePrint() {
    window.print();
  }

  const rateLabel = voucher.holidayRate ? P.holidayRate : P.weekdayRate;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{tLocal("thaiCost.sadaoVoucher.screenTitle")}</h2>
          <p className="text-sm text-haidee-muted">
            {formatDisplay(voucher.date)} ·{" "}
            {voucher.holidayRate
              ? tLocal("thaiCost.common.holidayRate")
              : tLocal("thaiCost.common.weekdayRate")}
            {voucher.fromDispatch && tLocal("thaiCost.sadaoVoucher.unsavedPreview")}
          </p>
        </div>
        {canPrint && (
          <Button
            type="button"
            className="gap-2 bg-haidee-blue text-white"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            {tLocal("thaiCost.common.print")}
          </Button>
        )}
      </div>

      <div ref={printRef} className="document-print rounded-lg border bg-white p-6">
        <PrintLetterhead
          nameZh=""
          nameTh="บริษัท ไฮดี โลจิสติกส์ จำกัด"
          nameEn="HAI DEE LOGISTICS CO., LTD."
        />
        <h1 className="mt-4 text-center text-lg font-bold">{P.title}</h1>
        <p className="text-center text-sm">
          {P.date}: {formatDisplay(voucher.date)}
        </p>
        <p className="text-center text-xs text-gray-600">{rateLabel}</p>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 text-left">{P.colCrateType}</th>
              <th className="py-2 text-right">{P.colBillableQty}</th>
              <th className="py-2 text-right">{P.colUnitRate}</th>
              <th className="py-2 text-right">{P.colAmount}</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  {P.noBillableQty}
                </td>
              </tr>
            ) : (
              voucher.lines.map((line) => (
                <tr key={line.bucket} className="border-b border-gray-300">
                  <td className="py-2">{line.label}</td>
                  <td className="py-2 text-right font-mono">
                    {line.billableQty}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {money(line.unitRateThb)}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {money(line.amountThb)}
                  </td>
                </tr>
              ))
            )}
            <tr className="border-t-2 border-black font-bold">
              <td colSpan={3} className="py-2 text-right">
                {P.total}
              </td>
              <td className="py-2 text-right font-mono">
                {money(voucher.totalThb)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-gray-600">
          <div>
            <p className="font-medium text-black">{P.dispatchTotals}</p>
            <p>
              {P.small} {voucher.totals.smallCrateTotalQty} / {P.large}{" "}
              {voucher.totals.largeCrateTotalQty} / {P.box}{" "}
              {voucher.totals.boxTotalQty}
            </p>
          </div>
          <div>
            <p className="font-medium text-black">{P.direct}</p>
            <p>
              {P.small} {voucher.directQty.smallCrateNoCheckQty} / {P.large}{" "}
              {voucher.directQty.largeCrateNoCheckQty} / {P.box}{" "}
              {voucher.directQty.boxNoCheckQty}
            </p>
          </div>
          <div>
            <p className="font-medium text-black">{P.notes}</p>
            <p>{voucher.notes ?? "—"}</p>
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-500">{P.footer}</p>

        <div className="mt-10 flex justify-end">
          <div className="w-48 text-center text-sm">
            <div className="border-t border-black pt-1">{P.foremanSignature}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
