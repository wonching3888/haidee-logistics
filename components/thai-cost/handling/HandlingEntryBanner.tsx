"use client";

import Link from "next/link";
import { useT } from "@/components/shared/locale-context";

export function HandlingEntryBanner({ date }: { date?: string }) {
  const { tLocal } = useT();
  const href = date
    ? `/thai-cost/handling?date=${date}`
    : "/thai-cost/handling";
  return (
    <div className="rounded-md border border-haidee-blue/30 bg-haidee-blue/5 px-4 py-3 text-sm">
      <p>{tLocal("thaiCost.handling.historyBanner")}</p>
      <Link href={href} className="mt-1 inline-block text-haidee-blue underline">
        {tLocal("thaiCost.handling.historyBannerLink")} →
      </Link>
    </div>
  );
}
