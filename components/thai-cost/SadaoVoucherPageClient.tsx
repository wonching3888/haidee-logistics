"use client";

import Link from "next/link";
import { SadaoVoucherView } from "@/components/thai-cost/SadaoVoucherView";
import { useT } from "@/components/shared/locale-context";
import type { SadaoVoucherDetail } from "@/lib/thai-cost/sadao-voucher";

export function SadaoVoucherPageClient({
  date,
  voucher,
}: {
  date: string;
  voucher: SadaoVoucherDetail | null;
}) {
  const { tLocal } = useT();
  const year = date.slice(0, 4);
  const month = Number(date.slice(5, 7));

  return (
    <div className="space-y-4">
      <div className="no-print">
        <Link
          href={`/thai-cost/sadao-handling?year=${year}&month=${month}`}
          className="text-sm text-haidee-blue underline"
        >
          {tLocal("thaiCost.sadaoVoucher.backLink")}
        </Link>
      </div>
      {!voucher ? (
        <p className="rounded-lg border p-8 text-center text-haidee-muted">
          {tLocal("thaiCost.sadaoVoucher.noData", { date })}
        </p>
      ) : (
        <SadaoVoucherView voucher={voucher} canPrint />
      )}
    </div>
  );
}
