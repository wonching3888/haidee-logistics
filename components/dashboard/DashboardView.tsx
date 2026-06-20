"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { DashboardData } from "@/app/actions/dashboard";
import { DailyDispatchSummarySection } from "@/components/dashboard/DailyDispatchSummarySection";
import { DispatchMarketLabel } from "@/components/dispatch/DispatchMarketLabel";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { stickyFirstColTableClass } from "@/lib/table-scroll";
import { DateInputField } from "@/components/shared/DateInputField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DashboardViewProps extends DashboardData {
  userName?: string | null;
}

export function DashboardView({
  dateInput,
  stats,
  dailySummary,
  dispatchOrders,
  userName,
}: DashboardViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDateChange(nextDate: string) {
    if (!nextDate || nextDate === dateInput) return;
    startTransition(() => {
      router.push(`/dashboard?date=${nextDate}`);
    });
  }

  const statCards = [
    {
      title: "进桶总数",
      titleEn: "Today Inbound",
      value: stats.todayInbound.toLocaleString(),
      href: `/inbound?date=${dateInput}`,
    },
    {
      title: "未分配桶数",
      titleEn: "Unassigned",
      value: stats.unassigned.toLocaleString(),
      href: `/dispatch?date=${dateInput}`,
      highlight: stats.unassigned > 0 ? "orange" : undefined,
    },
    {
      title: "已出发车辆",
      titleEn: "Dispatched",
      value: stats.dispatchCount.toLocaleString(),
      href: `/dispatch?date=${dateInput}`,
    },
  ];

  return (
    <div
      className={`w-full min-w-0 space-y-6 md:mx-auto md:max-w-6xl ${isPending ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            总览 Dashboard
          </h2>
          {userName && (
            <p className="text-sm text-haidee-muted">欢迎回来，{userName}</p>
          )}
        </div>
        <DateInputField
          value={dateInput}
          onChange={handleDateChange}
          className="max-w-[11.5rem]"
        />
      </div>

      <div className="flex w-full min-w-0 gap-1.5 md:grid md:grid-cols-3 md:gap-4">
        {statCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="min-w-0 flex-1 md:block"
          >
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-haidee-border bg-white px-1.5 py-2.5 text-center shadow-sm transition-shadow hover:shadow-md md:min-h-[120px] md:p-5">
              <p className="w-full text-xs font-medium leading-tight text-haidee-muted max-md:whitespace-normal md:text-sm">
                <span className="md:hidden">{card.title}</span>
                <span className="hidden md:inline">
                  {card.title} {card.titleEn}
                </span>
              </p>
              <p
                className={`mt-1 w-full font-mono text-3xl font-bold max-md:leading-none md:mt-2 ${
                  card.highlight === "orange"
                    ? "text-haidee-orange"
                    : "text-haidee-text"
                }`}
              >
                {card.value}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <DailyDispatchSummarySection data={dailySummary} />

      <Card className="border-haidee-border">
        <CardHeader>
          <CardTitle className="text-haidee-text">
            派车单 Dispatch Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dispatchOrders.length === 0 ? (
            <p className="p-6 text-center text-sm text-haidee-muted">
              当日暂无派车单 No dispatch orders for this date
            </p>
          ) : (
            <>
              <div className="space-y-3 p-4 max-md:block md:hidden">
                {dispatchOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/dispatch/${o.id}`}
                    className="block rounded-xl border border-haidee-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-mono text-xl font-bold text-haidee-text">
                        {o.truckPlate}
                      </p>
                      <p className="shrink-0 font-mono text-2xl font-bold text-haidee-blue">
                        {o.totalQty}
                        <span className="ml-1 text-sm font-medium text-haidee-muted">
                          桶
                        </span>
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {o.markets.length > 0 ? (
                        o.markets.map((code) => (
                          <DispatchMarketLabel key={code} code={code} />
                        ))
                      ) : (
                        <span className="text-sm text-haidee-muted">—</span>
                      )}
                    </div>
                    {o.dispatchNo && (
                      <p className="mt-2 font-mono text-xs text-haidee-muted">
                        {o.dispatchNo}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
              <ScrollMatrixTable heightOffset={360} className="hidden md:block">
              <Table noScrollContainer className={stickyFirstColTableClass}>
                <TableHeader>
                  <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                    <TableHead>单号 DO</TableHead>
                    <TableHead>日期 Date</TableHead>
                    <TableHead>车牌 Plate</TableHead>
                    <TableHead>司机 Driver</TableHead>
                    <TableHead>市场 Markets</TableHead>
                    <TableHead className="text-right">装载 Load</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatchOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link
                          href={`/dispatch/${o.id}`}
                          className="font-mono text-sm text-haidee-blue hover:underline"
                        >
                          {o.dispatchNo ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {o.date}
                      </TableCell>
                      <TableCell className="font-mono">{o.truckPlate}</TableCell>
                      <TableCell className="text-sm">
                        {o.driverName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {o.markets.map((code) => (
                            <DispatchMarketLabel key={code} code={code} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {o.totalQty}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </ScrollMatrixTable>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
