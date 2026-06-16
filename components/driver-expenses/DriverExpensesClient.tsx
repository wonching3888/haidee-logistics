"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { DateInputField } from "@/components/shared/DateInputField";
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
import "./driver-expense-print.css";

interface DriverExpensesClientProps {
  initialDate: string;
}

interface UnloadingFeeRow {
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

interface CrateLoadingFeeRow {
  id: string;
  tripId: string;
  tripDate: string;
  lorry: string;
  driver: string;
  route: string;
  market: string;
  truckSize: string;
  loadingFee: number;
  loadingFeeOverride: number | null;
}

interface DriverVoucherRow {
  id: string;
  voucherNo: string;
  tripId: string;
  lorry: string;
  driverName: string;
  route: string;
  duitJalan: number | null;
  belanja: number | null;
  baki: number | null;
}

interface DispatchOption {
  id: string;
  lorry: string;
  driver: string;
  route: string;
}

interface TripGroup<T> {
  tripId: string;
  lorry: string;
  driver: string;
  route: string;
  rows: T[];
  subtotal: number;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function effectiveLoadingFee(row: CrateLoadingFeeRow) {
  return row.loadingFeeOverride ?? row.loadingFee;
}

function groupUnloadingFees(fees: UnloadingFeeRow[]): TripGroup<UnloadingFeeRow>[] {
  const map = new Map<string, TripGroup<UnloadingFeeRow>>();
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

function groupLoadingFees(fees: CrateLoadingFeeRow[]): TripGroup<CrateLoadingFeeRow>[] {
  const map = new Map<string, TripGroup<CrateLoadingFeeRow>>();
  for (const fee of fees) {
    const existing = map.get(fee.tripId);
    const sub = effectiveLoadingFee(fee);
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

function ModuleCard({
  title,
  compact,
  children,
}: {
  title: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
      <header className="border-b border-haidee-border bg-haidee-surface/40 px-4 py-3">
        <h3 className="font-semibold text-haidee-text">{title}</h3>
      </header>
      <div className={compact ? "p-3" : "p-4"}>{children}</div>
    </section>
  );
}

export function DriverExpensesClient({ initialDate }: DriverExpensesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(initialDate);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [unloadingFees, setUnloadingFees] = useState<UnloadingFeeRow[]>([]);
  const [loadingFees, setLoadingFees] = useState<CrateLoadingFeeRow[]>([]);
  const [vouchers, setVouchers] = useState<DriverVoucherRow[]>([]);
  const [dispatches, setDispatches] = useState<DispatchOption[]>([]);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<
    | { type: "unloading"; tripId: string }
    | { type: "loading"; tripId: string }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const hasLoaded = loadedDate === date;
  const unloadingGroups = useMemo(
    () => groupUnloadingFees(unloadingFees),
    [unloadingFees]
  );
  const loadingGroups = useMemo(
    () => groupLoadingFees(loadingFees),
    [loadingFees]
  );

  const loadAll = useCallback(async (targetDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        startDate: targetDate,
        endDate: targetDate,
      });
      const [unloadingRes, loadingRes, voucherRes, dispatchRes] =
        await Promise.all([
          fetch(`/api/unloading-fees?${qs}`),
          fetch(`/api/crate-loading-fees?${qs}`),
          fetch(`/api/driver-vouchers?${qs}`),
          fetch(`/api/driver-expenses/dispatches?date=${targetDate}`),
        ]);

      if (!unloadingRes.ok || !loadingRes.ok || !voucherRes.ok) {
        throw new Error("加载失败 Failed to load data");
      }

      const [unloadingData, loadingData, voucherData, dispatchData] =
        await Promise.all([
          unloadingRes.json() as Promise<{ fees?: UnloadingFeeRow[] }>,
          loadingRes.json() as Promise<{ fees?: CrateLoadingFeeRow[] }>,
          voucherRes.json() as Promise<{ vouchers?: DriverVoucherRow[] }>,
          dispatchRes.ok
            ? (dispatchRes.json() as Promise<{ dispatches?: DispatchOption[] }>)
            : Promise.resolve({ dispatches: [] }),
        ]);

      setUnloadingFees(unloadingData.fees ?? []);
      setLoadingFees(loadingData.fees ?? []);
      setVouchers(voucherData.vouchers ?? []);
      setDispatches(dispatchData.dispatches ?? []);
      setLoadedDate(targetDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  function updateDate(next: string) {
    setDate(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", next);
    router.push(`/documents/driver-expenses?${params.toString()}`);
  }

  function handleSearch() {
    void loadAll(date);
  }

  async function syncFees() {
    setSyncing(true);
    setError(null);
    try {
      let tripIds = dispatches.map((d) => d.id);
      if (tripIds.length === 0) {
        const res = await fetch(`/api/driver-expenses/dispatches?date=${date}`);
        if (res.ok) {
          const data = (await res.json()) as { dispatches?: DispatchOption[] };
          tripIds = (data.dispatches ?? []).map((d) => d.id);
          setDispatches(data.dispatches ?? []);
        }
      }
      await Promise.all(
        tripIds.map((tripId) =>
          fetch("/api/unloading-fees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId, syncAll: true }),
          }).then(async (res) => {
            if (!res.ok) {
              const data = (await res.json()) as { error?: string };
              throw new Error(data.error ?? "同步失败");
            }
          })
        )
      );
      await loadAll(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  }

  function toggleTrip(tripId: string) {
    setExpandedTrips((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  }

  function triggerPrint(
    target: { type: "unloading"; tripId: string } | { type: "loading"; tripId: string }
  ) {
    setPrintTarget(target);
    requestAnimationFrame(() => window.print());
  }

  async function patchUnloadingFee(
    id: string,
    field: "unloadFeeOverride" | "kpbFeeOverride",
    raw: string
  ) {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) return;
    try {
      const res = await fetch(`/api/unloading-fees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("保存失败");
      const data = (await res.json()) as { fee?: UnloadingFeeRow };
      if (data.fee) {
        setUnloadingFees((prev) =>
          prev.map((row) => (row.id === id ? { ...row, ...data.fee! } : row))
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  async function patchLoadingFee(id: string, raw: string) {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) return;
    try {
      const res = await fetch(`/api/crate-loading-fees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loadingFeeOverride: value }),
      });
      if (!res.ok) throw new Error("保存失败");
      const data = (await res.json()) as { fee?: CrateLoadingFeeRow };
      if (data.fee) {
        setLoadingFees((prev) =>
          prev.map((row) => (row.id === id ? { ...row, ...data.fee! } : row))
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  const printUnloadingGroup =
    printTarget?.type === "unloading"
      ? unloadingGroups.find((g) => g.tripId === printTarget.tripId)
      : null;
  const printLoadingGroup =
    printTarget?.type === "loading"
      ? loadingGroups.find((g) => g.tripId === printTarget.tripId)
      : null;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end gap-3 rounded-xl border border-haidee-border bg-white p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">日期 Date</label>
          <DateInputField value={date} onChange={updateDate} />
        </div>
        <Button
          onClick={handleSearch}
          disabled={loading}
          className="gap-2 bg-haidee-blue text-white hover:bg-haidee-blue/90"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          查询 Search
        </Button>
        <Button
          onClick={() => startTransition(() => syncFees())}
          disabled={syncing || isPending || !hasLoaded}
          variant="outline"
          className="gap-2"
        >
          {syncing || isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          生成/刷新费用
        </Button>
      </div>

      {error && (
        <p className="no-print rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!hasLoaded && !loading && (
        <p className="text-sm text-haidee-muted">
          请选择日期后点击「查询」加载数据
        </p>
      )}

      {hasLoaded && (
        <>
          <ModuleCard title="Module 1 — Upah Turun（下货费）">
            {unloadingGroups.length === 0 ? (
              <p className="text-sm text-haidee-muted">此日期暂无下货费记录</p>
            ) : (
              <div className="space-y-2">
                {unloadingGroups.map((group) => {
                  const expanded = expandedTrips.has(group.tripId);
                  return (
                    <div
                      key={group.tripId}
                      className="overflow-hidden rounded-lg border border-haidee-border"
                    >
                      <div className="no-print flex flex-wrap items-center gap-2 bg-haidee-surface/30 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleTrip(group.tripId)}
                          className="flex flex-1 flex-wrap items-center gap-2 text-left text-sm"
                        >
                          {expanded ? (
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
                          onClick={() =>
                            triggerPrint({
                              type: "unloading",
                              tripId: group.tripId,
                            })
                          }
                        >
                          <Printer className="h-3.5 w-3.5" />
                          打印
                        </Button>
                      </div>
                      {expanded && (
                        <ScrollMatrixTable
                          heightOffset={360}
                          className="border-0 rounded-none"
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
                                        patchUnloadingFee(
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
                                          patchUnloadingFee(
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
          </ModuleCard>

          <ModuleCard title="Module 2 — Upah Naik Tong（上桶费）" compact>
            {loadingGroups.length === 0 ? (
              <p className="text-sm text-haidee-muted">此日期暂无上桶费记录</p>
            ) : (
              <div className="space-y-2">
                {loadingGroups.map((group) => (
                  <div
                    key={group.tripId}
                    className="overflow-hidden rounded-lg border border-haidee-border"
                  >
                    <div className="no-print flex flex-wrap items-center gap-2 bg-haidee-surface/30 px-3 py-2">
                      <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{group.lorry}</span>
                        <span className="text-haidee-muted">{group.driver}</span>
                        <span className="text-haidee-muted">{group.route}</span>
                        <span className="ml-auto font-mono font-semibold">
                          {formatMyr(group.subtotal)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        onClick={() =>
                          triggerPrint({ type: "loading", tripId: group.tripId })
                        }
                      >
                        <Printer className="h-3.5 w-3.5" />
                        打印
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>市场</TableHead>
                          <TableHead>车种</TableHead>
                          <TableHead className="text-right">上桶费</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.market}</TableCell>
                            <TableCell>{row.truckSize}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                className={cn(
                                  "ml-auto h-8 w-24 text-right font-mono text-sm",
                                  row.loadingFeeOverride != null &&
                                    "text-orange-600"
                                )}
                                defaultValue={effectiveLoadingFee(row)}
                                key={`load-${row.id}-${row.loadingFeeOverride}`}
                                onBlur={(e) =>
                                  patchLoadingFee(row.id, e.target.value)
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </ModuleCard>

          <ModuleCard title="Module 3 — Driver Voucher（司机报销单）">
            <div className="no-print mb-4">
              <Link
                href={`/documents/driver-expenses/new?date=${date}`}
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                新增 Add New
              </Link>
            </div>
            {vouchers.length === 0 ? (
              <p className="text-sm text-haidee-muted">此日期暂无报销单</p>
            ) : (
              <ScrollMatrixTable heightOffset={320}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>单号</TableHead>
                      <TableHead>罗里</TableHead>
                      <TableHead>司机</TableHead>
                      <TableHead>路线</TableHead>
                      <TableHead className="text-right">路费</TableHead>
                      <TableHead className="text-right">支出</TableHead>
                      <TableHead className="text-right">余额</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-sm">
                          {v.voucherNo}
                        </TableCell>
                        <TableCell>{v.lorry}</TableCell>
                        <TableCell>{v.driverName}</TableCell>
                        <TableCell>{v.route}</TableCell>
                        <TableCell className="text-right font-mono">
                          {v.duitJalan != null ? formatMyr(v.duitJalan) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {v.belanja != null ? formatMyr(v.belanja) : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono font-medium",
                            v.baki != null && v.baki >= 0 && "text-green-600",
                            v.baki != null && v.baki < 0 && "text-red-600"
                          )}
                        >
                          {v.baki != null ? formatMyr(v.baki) : "—"}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/documents/driver-expenses/${v.id}?date=${date}`}
                            className="inline-flex h-8 items-center rounded-lg border border-input px-2.5 text-sm hover:bg-accent"
                          >
                            编辑
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollMatrixTable>
            )}
          </ModuleCard>
        </>
      )}

      {printUnloadingGroup && (
        <div className="driver-expense-print-area hidden print:block">
          <div className="print-title">
            Upah Turun — {printUnloadingGroup.lorry}
          </div>
          <p>
            {printUnloadingGroup.driver} · {printUnloadingGroup.route} · {date}
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
              {printUnloadingGroup.rows.map((row) => (
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
                  <td className="text-right">
                    {formatMyr(lineSubtotal(row))}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={6} className="text-right font-bold">
                  合计 Total
                </td>
                <td className="text-right font-bold">
                  {formatMyr(printUnloadingGroup.subtotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {printLoadingGroup && (
        <div className="driver-expense-print-area hidden print:block">
          <div className="print-title">
            Upah Naik Tong — {printLoadingGroup.lorry}
          </div>
          <p>
            {printLoadingGroup.driver} · {printLoadingGroup.route} · {date}
          </p>
          <table className="mt-3">
            <thead>
              <tr>
                <th>市场</th>
                <th>车种</th>
                <th>上桶费</th>
              </tr>
            </thead>
            <tbody>
              {printLoadingGroup.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.market}</td>
                  <td>{row.truckSize}</td>
                  <td className="text-right">
                    {formatMyr(effectiveLoadingFee(row))}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} className="text-right font-bold">
                  合计 Total
                </td>
                <td className="text-right font-bold">
                  {formatMyr(printLoadingGroup.subtotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
