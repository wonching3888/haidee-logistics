"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
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

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Sadao 搬运工头报销单</h2>
          <p className="text-sm text-haidee-muted">
            {formatDisplay(voucher.date)} ·{" "}
            {voucher.holidayRate ? "假日费率" : "平日费率"}
            {voucher.fromDispatch && " · 未保存记录（派车预览）"}
          </p>
        </div>
        {canPrint && (
          <Button
            type="button"
            className="gap-2 bg-haidee-blue text-white"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            打印
          </Button>
        )}
      </div>

      <div ref={printRef} className="document-print rounded-lg border bg-white p-6">
        <PrintLetterhead />
        <h1 className="mt-4 text-center text-lg font-bold">
          Sadao 搬运提成 Voucher
        </h1>
        <p className="text-center text-sm">
          日期 Tarikh: {formatDisplay(voucher.date)}
        </p>
        <p className="text-center text-xs text-gray-600">
          {voucher.holidayRate ? "假日费率 Holiday rate" : "平日费率 Weekday rate"}
        </p>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 text-left">桶型</th>
              <th className="py-2 text-right">计费数量</th>
              <th className="py-2 text-right">单价 (THB)</th>
              <th className="py-2 text-right">金额 (THB)</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  当日无计费数量
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
                合计 Jumlah
              </td>
              <td className="py-2 text-right font-mono">
                {money(voucher.totalThb)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-gray-600">
          <div>
            <p className="font-medium text-black">派车总数</p>
            <p>
              小 {voucher.totals.smallCrateTotalQty} / 大{" "}
              {voucher.totals.largeCrateTotalQty} / 盒{" "}
              {voucher.totals.boxTotalQty}
            </p>
          </div>
          <div>
            <p className="font-medium text-black">直达</p>
            <p>
              小 {voucher.directQty.smallCrateNoCheckQty} / 大{" "}
              {voucher.directQty.largeCrateNoCheckQty} / 盒{" "}
              {voucher.directQty.boxNoCheckQty}
            </p>
          </div>
          <div>
            <p className="font-medium text-black">备注</p>
            <p>{voucher.notes ?? "—"}</p>
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          不含法定扣款及月薪工人部分。此项计入全公司运费成本模型。
        </p>

        <div className="mt-10 flex justify-end">
          <div className="w-48 text-center text-sm">
            <div className="border-t border-black pt-1">工头签名</div>
          </div>
        </div>
      </div>
    </div>
  );
}
