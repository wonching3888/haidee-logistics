"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  effectiveKpbFee,
  effectiveUnloadFee,
  lineSubtotal,
} from "@/lib/unloading-calculator";
import { formatMyr } from "@/lib/driver-expense/voucher-utils";
import { cn } from "@/lib/utils";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import "./driver-expense-print.css";

export interface UnloadingFeeRow {
  id: string;
  tripId: string;
  tripDate: string;
  lorry: string;
  driver: string;
  route: string;
  market: string;
  storeCode: string | null;
  smallCrateQty: number;
  largeCrateQty: number;
  boxQty: number;
  unloadFee: number;
  kpbFee: number;
  unloadFeeOverride: number | null;
  kpbFeeOverride: number | null;
  isKpbExempt: boolean;
  tripLevelNote: string | null;
}

interface TripGroup {
  tripId: string;
  lorry: string;
  driver: string;
  route: string;
  rows: UnloadingFeeRow[];
  subtotal: number;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function groupUnloadingFees(fees: UnloadingFeeRow[]): TripGroup[] {
  const map = new Map<string, TripGroup>();
  for (const fee of fees) {
    const existing = map.get(fee.tripId);
    const sub = lineSubtotal(fee);
    if (existing) {
      existing.rows.push(fee);
      existing.subtotal = roundMoney(existing.subtotal + sub);
    } else {
      map.set(fee.tripId, {
        tripId: fee.tripId,
        lorry: fee.lorry,
        driver: fee.driver,
        route: fee.route,
        rows: [fee],
        subtotal: sub,
      });
    }
  }
  return Array.from(map.values());
}

interface UnloadingFeesCollapsibleProps {
  date: string;
  fees: UnloadingFeeRow[];
  hasLoaded: boolean;
  onPatchFee: (
    id: string,
    field: "unloadFeeOverride" | "kpbFeeOverride",
    raw: string
  ) => Promise<void>;
}

export function UnloadingFeesCollapsible({
  date,
  fees,
  hasLoaded,
  onPatchFee,
}: UnloadingFeesCollapsibleProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [printTarget, setPrintTarget] = useState<string | null>(null);

  const groups = useMemo(() => groupUnloadingFees(fees), [fees]);
  const totalMyr = useMemo(
    () => roundMoney(groups.reduce((sum, g) => sum + g.subtotal, 0)),
    [groups]
  );

  function toggleTrip(tripId: string) {
    setExpandedTrips((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  }

  function triggerPrint(tripId: string) {
    setPrintTarget(tripId);
    requestAnimationFrame(() => window.print());
  }

  const printGroup = printTarget
    ? groups.find((g) => g.tripId === printTarget)
    : null;

  return (
    <section className="overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
      <header className="border-b border-haidee-border bg-haidee-surface/40 px-4 py-3">
        <h3 className="font-semibold text-haidee-text">
          Module 1 — Upah Turun（下货费）
        </h3>
      </header>
      <div className="p-4">
        {!hasLoaded ? (
          <p className="text-sm text-haidee-muted">
            查询当日数据后可查看下货费摘要
          </p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-haidee-muted">
            此日期暂无下货费记录（派车保存后会自动生成估算）
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="no-print flex w-full items-center gap-2 rounded-lg border border-haidee-border bg-haidee-surface/30 px-3 py-2 text-left text-sm"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" />
              )}
              <span>
                今日下货费合计{" "}
                <span className="font-mono font-semibold">
                  {formatMyr(totalMyr)} MYR
                </span>
                <span className="text-haidee-muted"> · {groups.length} 趟</span>
              </span>
              <span className="ml-auto text-haidee-muted">
                {expanded ? "收起" : "展开明细"}
              </span>
            </button>

            {expanded && (
              <div className="no-print mt-3 space-y-2">
                {groups.map((group) => {
                  const tripExpanded = expandedTrips.has(group.tripId);
                  return (
                    <div
                      key={group.tripId}
                      className="overflow-hidden rounded-lg border border-haidee-border"
                    >
                      <div className="flex flex-wrap items-center gap-2 bg-haidee-surface/30 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleTrip(group.tripId)}
                          className="flex flex-1 flex-wrap items-center gap-2 text-left text-sm"
                        >
                          {tripExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          <span className="font-medium">{group.lorry}</span>
                          <span className="text-haidee-muted">{group.driver}</span>
                          <span className="text-haidee-muted">{group.route}</span>
                          <span className="ml-auto font-mono font-semibold">
                            {formatMyr(group.subtotal)}
                          </span>
                        </button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1"
                          onClick={() => triggerPrint(group.tripId)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          打印
                        </Button>
                      </div>
                      {tripExpanded && (
                        <ScrollMatrixTable
                          heightOffset={360}
                          className="rounded-none border-0"
                        >
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>市场</TableHead>
                                <TableHead className="text-right">小桶</TableHead>
                                <TableHead className="text-right">大桶</TableHead>
                                <TableHead className="text-right">箱</TableHead>
                                <TableHead className="text-right">下货费</TableHead>
                                <TableHead className="text-right">KPB</TableHead>
                                <TableHead className="text-right">小计</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.rows.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell>
                                    <div>{row.market}</div>
                                    {row.tripLevelNote && (
                                      <div className="text-xs text-haidee-muted">
                                        {row.tripLevelNote}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {row.smallCrateQty}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {row.largeCrateQty}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {row.boxQty}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className={cn(
                                        "ml-auto h-8 w-24 text-right font-mono text-sm",
                                        row.unloadFeeOverride != null &&
                                          "text-orange-600"
                                      )}
                                      defaultValue={
                                        row.unloadFeeOverride ?? row.unloadFee
                                      }
                                      key={`unload-${row.id}-${row.unloadFeeOverride}`}
                                      onBlur={(e) =>
                                        void onPatchFee(
                                          row.id,
                                          "unloadFeeOverride",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {row.isKpbExempt ? (
                                      <Badge
                                        variant="secondary"
                                        className="text-haidee-muted"
                                      >
                                        免收
                                      </Badge>
                                    ) : (
                                      <Input
                                        type="number"
                                        step="0.01"
                                        className={cn(
                                          "ml-auto h-8 w-24 text-right font-mono text-sm",
                                          row.kpbFeeOverride != null &&
                                            "text-orange-600"
                                        )}
                                        defaultValue={
                                          row.kpbFeeOverride ?? row.kpbFee
                                        }
                                        key={`kpb-${row.id}-${row.kpbFeeOverride}`}
                                        onBlur={(e) =>
                                          void onPatchFee(
                                            row.id,
                                            "kpbFeeOverride",
                                            e.target.value
                                          )
                                        }
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-medium">
                                    {formatMyr(lineSubtotal(row))}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollMatrixTable>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {printGroup && (
        <div className="driver-expense-print-area hidden print:block">
          <PrintLetterhead nameEn="Hai Dee Logistics Co.,Ltd" />
          <div className="print-title">Upah Turun — {printGroup.lorry}</div>
          <p>
            {printGroup.driver} · {printGroup.route} · {date}
          </p>
          <table className="mt-3">
            <thead>
              <tr>
                <th>市场</th>
                <th>小桶</th>
                <th>大桶</th>
                <th>箱</th>
                <th>下货费</th>
                <th>KPB</th>
                <th>小计</th>
              </tr>
            </thead>
            <tbody>
              {printGroup.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.market}
                    {row.tripLevelNote && (
                      <div style={{ fontSize: "10px", color: "#666" }}>
                        {row.tripLevelNote}
                      </div>
                    )}
                  </td>
                  <td className="text-right">{row.smallCrateQty}</td>
                  <td className="text-right">{row.largeCrateQty}</td>
                  <td className="text-right">{row.boxQty}</td>
                  <td className="text-right">
                    {formatMyr(effectiveUnloadFee(row))}
                  </td>
                  <td className="text-right">
                    {row.isKpbExempt
                      ? "免收"
                      : formatMyr(effectiveKpbFee(row))}
                  </td>
                  <td className="text-right">{formatMyr(lineSubtotal(row))}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={6} className="text-right font-bold">
                  合计 Total
                </td>
                <td className="text-right font-bold">
                  {formatMyr(printGroup.subtotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
