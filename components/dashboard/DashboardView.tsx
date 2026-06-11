import Link from "next/link";
import type { DailyDispatchSummaryData } from "@/app/actions/dashboard";
import { DailyDispatchSummary } from "@/components/dashboard/DailyDispatchSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sortMarkets } from "@/lib/constants/markets";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface DashboardViewProps {
  todayStr: string;
  dailySummary: DailyDispatchSummaryData;
  stats: {
    todayInbound: number;
    unassigned: number;
    dispatchCount: number;
    totalSadaoStock: number;
  };
  marketTotals: Record<string, number>;
  unassignedWarning?: { total: number; olderThanToday: number } | null;
  recentOrders: {
    id: string;
    dispatchNo: string | null;
    date: string;
    truckPlate: string;
    driverName: string | null;
    markets: string[];
    status: string;
    totalQty: number;
    capacity: number | null;
  }[];
}

export function DashboardView({
  todayStr,
  dailySummary,
  stats,
  marketTotals,
  unassignedWarning,
  recentOrders,
}: DashboardViewProps) {
  const statCards = [
    {
      title: "今日进货总桶数",
      titleEn: "Today Inbound",
      value: stats.todayInbound.toLocaleString(),
      href: "/inbound",
    },
    {
      title: "未分配桶数",
      titleEn: "Unassigned",
      value: stats.unassigned.toLocaleString(),
      href: "/dispatch",
      highlight: stats.unassigned > 0 ? "orange" : undefined,
    },
    {
      title: "已出发车辆数",
      titleEn: "Dispatched Today",
      value: stats.dispatchCount.toLocaleString(),
      href: "/dispatch",
    },
    {
      title: "SADAO库存",
      titleEn: "SADAO Stock",
      value: stats.totalSadaoStock.toLocaleString(),
      href: "/crate/stock",
    },
  ];

  const marketEntries = sortMarkets(
    Object.keys(marketTotals).filter((c) => marketTotals[c] > 0)
  ).map((code) => [code, marketTotals[code]] as const);

  return (
    <div className="space-y-6">
    <div className="dashboard-main mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">总览 Dashboard</h2>
        <p className="text-sm text-haidee-muted">今日 {todayStr}</p>
      </div>

      {unassignedWarning && unassignedWarning.olderThanToday > 0 && (
        <div className="rounded-lg border border-haidee-orange bg-orange-50 px-4 py-3 text-sm text-haidee-orange">
          ⚠️ 有 {unassignedWarning.total.toLocaleString()} 桶货物未分配（含昨日及以前）
          <span className="ml-2 text-haidee-muted">
            {unassignedWarning.olderThanToday.toLocaleString()} buckets unassigned from prior days
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.title} href={card.href} className="block">
            <div className="rounded-xl border border-haidee-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-sm font-medium text-haidee-muted">
                {card.title} {card.titleEn}
              </p>
              <p
                className={`mt-2 font-mono text-3xl font-bold ${
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

      {marketEntries.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
          <div className="border-b border-haidee-border px-4 py-3">
            <h3 className="text-sm font-semibold text-haidee-text">
              各市场今日桶数 Market Totals Today
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>市场 Market</TableHead>
                <TableHead className="text-right">桶数 Crates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marketEntries.map(([code, qty]) => (
                <TableRow key={code}>
                  <TableCell className="font-mono">{code}</TableCell>
                  <TableCell className="text-right font-mono">{qty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Card className="border-haidee-border">
        <CardHeader>
          <CardTitle className="text-haidee-text">
            最新派车单 Recent Dispatch Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentOrders.length === 0 ? (
            <p className="p-6 text-center text-sm text-haidee-muted">
              暂无派车单 No dispatch orders yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                  <TableHead>单号 DO</TableHead>
                  <TableHead>日期 Date</TableHead>
                  <TableHead>车牌 Plate</TableHead>
                  <TableHead className="text-right">装载 Load</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/dispatch/${o.id}`}
                        className="font-mono text-sm text-haidee-blue hover:underline"
                      >
                        {o.dispatchNo ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{o.date}</TableCell>
                    <TableCell className="font-mono">{o.truckPlate}</TableCell>
                    <TableCell className="text-right font-mono">
                      {o.totalQty}
                      {o.capacity ? ` / ${o.capacity}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={o.status === "confirmed" ? "default" : "secondary"}
                      >
                        {o.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>

    <div className="dashboard-daily-summary mx-auto w-full max-w-6xl">
      <DailyDispatchSummary initialData={dailySummary} />
    </div>
    </div>
  );
}
