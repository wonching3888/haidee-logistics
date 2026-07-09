"use client";

import Link from "next/link";
import { useT } from "@/components/shared/locale-context";

const HISTORY_HREF: Record<"sadao" | "songkhla" | "pattani", string> = {
  sadao: "/thai-cost/sadao-handling",
  songkhla: "/thai-cost/songkhla-handling",
  pattani: "/thai-cost/pattani-handling",
};

export function HandlingHistoryLink({
  station,
  date,
}: {
  station: "sadao" | "songkhla" | "pattani";
  date: string;
}) {
  const { tLocal } = useT();
  const year = date.slice(0, 4);
  const month = date.slice(5, 7);
  return (
    <Link
      href={`${HISTORY_HREF[station]}?year=${year}&month=${month}`}
      className="text-sm text-haidee-blue underline hover:no-underline"
    >
      {tLocal("thaiCost.handling.viewHistory")}
    </Link>
  );
}
