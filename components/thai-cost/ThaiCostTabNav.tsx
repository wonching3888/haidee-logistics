"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "attendance", label: "日薪出勤", href: "/thai-cost/attendance" },
  { id: "sadao", label: "Sadao搬运", href: "/thai-cost/sadao-handling" },
  {
    id: "songkhla",
    label: "宋卡搬运",
    href: "/thai-cost/songkhla-handling",
  },
  {
    id: "pattani",
    label: "北大年搬运",
    href: "/thai-cost/pattani-handling",
  },
  { id: "driver-trips", label: "司机趟次", href: "/thai-cost/driver-trips" },
  {
    id: "rented",
    label: "外部租车",
    href: "/thai-cost/rented-vehicles",
  },
] as const;

export function ThaiCostTabNav({
  activeTab,
}: {
  activeTab: (typeof TABS)[number]["id"];
}) {
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
          {tab.label}
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
  const searchParams = useSearchParams();
  const year = searchParams.get("year") ?? new Date().getFullYear();
  const month = searchParams.get("month") ?? new Date().getMonth() + 1;
  const qs = `?year=${year}&month=${month}`;

  const tabs = [
    { id: "sadao" as const, label: "Sadao", href: "/thai-cost/sadao-summary" },
    {
      id: "songkhla" as const,
      label: "宋卡",
      href: "/thai-cost/songkhla-summary",
    },
    {
      id: "pattani" as const,
      label: "北大年",
      href: "/thai-cost/pattani-summary",
    },
  ];

  return (
    <nav className="flex flex-wrap gap-1 border-b border-haidee-border pb-2">
      {tabs.map((tab) => (
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
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
