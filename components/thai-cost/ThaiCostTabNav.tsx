"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useT } from "@/components/shared/locale-context";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const TABS: { id: string; messageKey: MessageKey; href: string }[] = [
  { id: "attendance", messageKey: "thaiCost.tab.attendance", href: "/thai-cost/attendance" },
  { id: "sadao", messageKey: "thaiCost.tab.sadaoHandling", href: "/thai-cost/sadao-handling" },
  {
    id: "songkhla",
    messageKey: "thaiCost.tab.songkhlaHandling",
    href: "/thai-cost/songkhla-handling",
  },
  {
    id: "pattani",
    messageKey: "thaiCost.tab.pattaniHandling",
    href: "/thai-cost/pattani-handling",
  },
  { id: "driver-trips", messageKey: "thaiCost.tab.driverTrips", href: "/thai-cost/driver-trips" },
  {
    id: "rented",
    messageKey: "thaiCost.tab.rentedVehicles",
    href: "/thai-cost/rented-vehicles",
  },
];

const SUMMARY_TABS: { id: "sadao" | "songkhla" | "pattani"; messageKey: MessageKey; href: string }[] = [
  { id: "sadao", messageKey: "nav.thaiCostSadaoSummary", href: "/thai-cost/sadao-summary" },
  {
    id: "songkhla",
    messageKey: "thaiCost.tab.songkhla",
    href: "/thai-cost/songkhla-summary",
  },
  {
    id: "pattani",
    messageKey: "thaiCost.tab.pattani",
    href: "/thai-cost/pattani-summary",
  },
];

export function ThaiCostTabNav({
  activeTab,
}: {
  activeTab: (typeof TABS)[number]["id"];
}) {
  const { tLocal } = useT();
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const qs =
    year && month ? `?year=${year}&month=${month}` : year ? `?year=${year}` : "";

  return (
    <nav className="no-print flex flex-wrap gap-1 border-b border-haidee-border pb-2">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`${tab.href}${qs}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            activeTab === tab.id
              ? "bg-haidee-blue font-medium text-white"
              : "text-haidee-muted hover:bg-haidee-surface"
          )}
        >
          {tLocal(tab.messageKey)}
        </Link>
      ))}
    </nav>
  );
}

export function ThaiCostSummaryTabNav({
  activeTab,
}: {
  activeTab: "sadao" | "songkhla" | "pattani";
}) {
  const { tLocal } = useT();
  const searchParams = useSearchParams();
  const year = searchParams.get("year") ?? new Date().getFullYear();
  const month = searchParams.get("month") ?? new Date().getMonth() + 1;
  const qs = `?year=${year}&month=${month}`;

  return (
    <nav className="flex flex-wrap gap-1 border-b border-haidee-border pb-2">
      {SUMMARY_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`${tab.href}${qs}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            activeTab === tab.id
              ? "bg-haidee-blue font-medium text-white"
              : "text-haidee-muted hover:bg-haidee-surface"
          )}
        >
          {tab.id === "sadao" ? "Sadao" : tLocal(tab.messageKey)}
        </Link>
      ))}
    </nav>
  );
}
