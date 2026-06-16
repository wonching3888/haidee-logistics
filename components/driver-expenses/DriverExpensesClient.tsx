"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  tripDate: string;
  lorry: string;
  driverName: string;
  route: string;
  chopBorderAmt: number | null;
  chopBorderActual: number | null;
  parkingAmt: number | null;
  parkingActual: number | null;
  kpbAmt: number | null;
  kpbActual: number | null;
  fishCheckAmt: number | null;
  fishCheckActual: number | null;
  upahTurunAmt: number | null;
  upahTurunActual: number | null;
  upahNaikTongAmt: number | null;
  upahNaikTongActual: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoAmt: number;
  minyakMotoActual: number | null;
  duitJalan: number | null;
  belanja: number | null;
  baki: number | null;
}

interface DispatchOption {
  id: string;
  lorry: string;
  driver: string;
  route: string;
  date: string;
}

interface VoucherSuggestion {
  tripId: string;
  tripDate: string;
  lorry: string;
  driverName: string;
  route: string;
  chopBorderAmt: number;
  parkingAmt: number;
  kpbAmt: number;
  fishCheckAmt: number;
  upahTurunAmt: number;
  upahNaikTongAmt: number;
}

interface TripGroup<T> {
  tripId: string;
  tripDate: string;
  lorry: string;
  driver: string;
  route: string;
  rows: T[];
  subtotal: number;
}

function formatMyr(value: number) {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function effectiveLoadingFee(row: CrateLoadingFeeRow) {
  return row.loadingFeeOverride ?? row.loadingFee;
}

function sumActualBelanja(v: {
  chopBorderActual: number | null;
  parkingActual: number | null;
  kpbActual: number | null;
  fishCheckActual: number | null;
  upahTurunActual: number | null;
  upahNaikTongActual: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoActual: number | null;
}) {
  let total = 0;
  for (const value of [
    v.chopBorderActual,
    v.parkingActual,
    v.kpbActual,
    v.fishCheckActual,
    v.upahTurunActual,
    v.upahNaikTongActual,
  ]) {
    if (value != null) total += value;
  }
  if (v.minyakMotoEnabled && v.minyakMotoActual != null) {
    total += v.minyakMotoActual;
  }
  return roundMoney(total);
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
        tripDate: fee.tripDate,
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
        tripDate: fee.tripDate,
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
      <header className="border-b border-haidee-border bg-haidee-surface/40 px-4 py-3">
        <h3 className="font-semibold text-haidee-text">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function DriverExpensesClient({ initialDate }: DriverExpensesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(initialDate);
  const [unloadingFees, setUnloadingFees] = useState<UnloadingFeeRow[]>([]);
  const [loadingFees, setLoadingFees] = useState<CrateLoadingFeeRow[]>([]);
  const [vouchers, setVouchers] = useState<DriverVoucherRow[]>([]);
  const [dispatches, setDispatches] = useState<DispatchOption[]>([]);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<
    | { type: "unloading"; tripId: string }
    | { type: "loading"; tripId: string }
    | { type: "voucher"; id: string }
    | null
  >(null);
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<DriverVoucherRow | null>(
    null
  );
  const [voucherForm, setVoucherForm] = useState<{
    tripId: string;
    voucherNo: string;
    chopBorderAmt: string;
    chopBorderActual: string;
    parkingAmt: string;
    parkingActual: string;
    kpbAmt: string;
    kpbActual: string;
    fishCheckAmt: string;
    fishCheckActual: string;
    upahTurunAmt: string;
    upahTurunActual: string;
    upahNaikTongAmt: string;
    upahNaikTongActual: string;
    minyakMotoEnabled: boolean;
    minyakMotoAmt: string;
    minyakMotoActual: string;
    duitJalan: string;
    lorry: string;
    driverName: string;
    route: string;
  } | null>(null);
  const [voucherSaving, setVoucherSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  const unloadingGroups = useMemo(
    () => groupUnloadingFees(unloadingFees),
    [unloadingFees]
  );
  const loadingGroups = useMemo(
    () => groupLoadingFees(loadingFees),
    [loadingFees]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ startDate: date, endDate: date });
      const [unloadingRes, loadingRes, voucherRes, dispatchRes] =
        await Promise.all([
          fetch(`/api/unloading-fees?${qs}`),
          fetch(`/api/crate-loading-fees?${qs}`),
          fetch(`/api/driver-vouchers?${qs}`),
          fetch(`/api/driver-expenses/dispatches?date=${date}`),
        ]);

      if (!unloadingRes.ok || !loadingRes.ok || !voucherRes.ok) {
        throw new Error("加载失败 Failed to load data");
      }

      const unloadingData = (await unloadingRes.json()) as {
        fees?: UnloadingFeeRow[];
      };
      const loadingData = (await loadingRes.json()) as {
        fees?: CrateLoadingFeeRow[];
      };
      const voucherData = (await voucherRes.json()) as {
        vouchers?: DriverVoucherRow[];
      };

      setUnloadingFees(unloadingData.fees ?? []);
      setLoadingFees(loadingData.fees ?? []);
      setVouchers(voucherData.vouchers ?? []);

      if (dispatchRes.ok) {
        const dispatchData = (await dispatchRes.json()) as {
          dispatches?: DispatchOption[];
        };
        setDispatches(dispatchData.dispatches ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function updateDate(next: string) {
    setDate(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", next);
    router.push(`/documents/driver-expenses?${params.toString()}`);
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
      for (const tripId of tripIds) {
        const res = await fetch("/api/unloading-fees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, syncAll: true }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "同步失败");
        }
      }
      await loadAll();
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
    target:
      | { type: "unloading"; tripId: string }
      | { type: "loading"; tripId: string }
      | { type: "voucher"; id: string }
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

  async function openNewVoucherDialog() {
    setEditingVoucher(null);
    setVoucherForm(null);
    setVoucherDialogOpen(true);
  }

  async function openEditVoucher(voucher: DriverVoucherRow) {
    setEditingVoucher(voucher);
    setVoucherForm({
      tripId: voucher.tripId,
      voucherNo: voucher.voucherNo,
      chopBorderAmt: String(voucher.chopBorderAmt ?? ""),
      chopBorderActual: String(voucher.chopBorderActual ?? ""),
      parkingAmt: String(voucher.parkingAmt ?? ""),
      parkingActual: String(voucher.parkingActual ?? ""),
      kpbAmt: String(voucher.kpbAmt ?? ""),
      kpbActual: String(voucher.kpbActual ?? ""),
      fishCheckAmt: String(voucher.fishCheckAmt ?? ""),
      fishCheckActual: String(voucher.fishCheckActual ?? ""),
      upahTurunAmt: String(voucher.upahTurunAmt ?? ""),
      upahTurunActual: String(voucher.upahTurunActual ?? ""),
      upahNaikTongAmt: String(voucher.upahNaikTongAmt ?? ""),
      upahNaikTongActual: String(voucher.upahNaikTongActual ?? ""),
      minyakMotoEnabled: voucher.minyakMotoEnabled,
      minyakMotoAmt: String(voucher.minyakMotoAmt ?? "8"),
      minyakMotoActual: String(voucher.minyakMotoActual ?? ""),
      duitJalan: String(voucher.duitJalan ?? ""),
      lorry: voucher.lorry,
      driverName: voucher.driverName,
      route: voucher.route,
    });
    setVoucherDialogOpen(true);
  }

  async function prepareVoucherForTrip(tripId: string) {
    setVoucherSaving(true);
    setError(null);
    try {
      const [prepRes, noRes] = await Promise.all([
        fetch("/api/driver-vouchers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prepareTripId: tripId }),
        }),
        fetch(`/api/driver-vouchers/voucher-no?tripDate=${date}`),
      ]);
      if (!prepRes.ok || !noRes.ok) throw new Error("无法获取建议金额");
      const prepData = (await prepRes.json()) as { suggestion?: VoucherSuggestion };
      const noData = (await noRes.json()) as { voucherNo?: string };
      const s = prepData.suggestion;
      if (!s) throw new Error("无建议数据");
      setVoucherForm({
        tripId: s.tripId,
        voucherNo: noData.voucherNo ?? "",
        chopBorderAmt: String(s.chopBorderAmt),
        chopBorderActual: "",
        parkingAmt: String(s.parkingAmt),
        parkingActual: "",
        kpbAmt: String(s.kpbAmt),
        kpbActual: "",
        fishCheckAmt: String(s.fishCheckAmt),
        fishCheckActual: "",
        upahTurunAmt: String(s.upahTurunAmt),
        upahTurunActual: "",
        upahNaikTongAmt: String(s.upahNaikTongAmt),
        upahNaikTongActual: "",
        minyakMotoEnabled: false,
        minyakMotoAmt: "8",
        minyakMotoActual: "",
        duitJalan: "",
        lorry: s.lorry,
        driverName: s.driverName,
        route: s.route,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "准备失败");
    } finally {
      setVoucherSaving(false);
    }
  }

  async function saveVoucher() {
    if (!voucherForm) return;
    setVoucherSaving(true);
    setError(null);
    try {
      const payload = {
        tripId: voucherForm.tripId,
        voucherNo: voucherForm.voucherNo,
        chopBorderAmt: parseOptionalNumber(voucherForm.chopBorderAmt),
        chopBorderActual: parseOptionalNumber(voucherForm.chopBorderActual),
        parkingAmt: parseOptionalNumber(voucherForm.parkingAmt),
        parkingActual: parseOptionalNumber(voucherForm.parkingActual),
        kpbAmt: parseOptionalNumber(voucherForm.kpbAmt),
        kpbActual: parseOptionalNumber(voucherForm.kpbActual),
        fishCheckAmt: parseOptionalNumber(voucherForm.fishCheckAmt),
        fishCheckActual: parseOptionalNumber(voucherForm.fishCheckActual),
        upahTurunAmt: parseOptionalNumber(voucherForm.upahTurunAmt),
        upahTurunActual: parseOptionalNumber(voucherForm.upahTurunActual),
        upahNaikTongAmt: parseOptionalNumber(voucherForm.upahNaikTongAmt),
        upahNaikTongActual: parseOptionalNumber(voucherForm.upahNaikTongActual),
        minyakMotoEnabled: voucherForm.minyakMotoEnabled,
        minyakMotoAmt: parseOptionalNumber(voucherForm.minyakMotoAmt) ?? 8,
        minyakMotoActual: parseOptionalNumber(voucherForm.minyakMotoActual),
        duitJalan: parseOptionalNumber(voucherForm.duitJalan),
      };

      const url = editingVoucher
        ? `/api/driver-vouchers/${editingVoucher.id}`
        : "/api/driver-vouchers";
      const res = await fetch(url, {
        method: editingVoucher ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "保存失败");
      }
      setVoucherDialogOpen(false);
      setVoucherForm(null);
      setEditingVoucher(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setVoucherSaving(false);
    }
  }

  const voucherBelanja = voucherForm
    ? sumActualBelanja({
        chopBorderActual: parseOptionalNumber(voucherForm.chopBorderActual),
        parkingActual: parseOptionalNumber(voucherForm.parkingActual),
        kpbActual: parseOptionalNumber(voucherForm.kpbActual),
        fishCheckActual: parseOptionalNumber(voucherForm.fishCheckActual),
        upahTurunActual: parseOptionalNumber(voucherForm.upahTurunActual),
        upahNaikTongActual: parseOptionalNumber(voucherForm.upahNaikTongActual),
        minyakMotoEnabled: voucherForm.minyakMotoEnabled,
        minyakMotoActual: parseOptionalNumber(voucherForm.minyakMotoActual),
      })
    : 0;
  const voucherDuitJalan = voucherForm
    ? parseOptionalNumber(voucherForm.duitJalan)
    : null;
  const voucherBaki =
    voucherDuitJalan != null
      ? roundMoney(voucherDuitJalan - voucherBelanja)
      : null;

  const printUnloadingGroup =
    printTarget?.type === "unloading"
      ? unloadingGroups.find((g) => g.tripId === printTarget.tripId)
      : null;
  const printLoadingGroup =
    printTarget?.type === "loading"
      ? loadingGroups.find((g) => g.tripId === printTarget.tripId)
      : null;
  const printVoucher =
    printTarget?.type === "voucher"
      ? vouchers.find((v) => v.id === printTarget.id)
      : null;

  const voucherTripsWithoutVoucher = dispatches.filter(
    (d) => !vouchers.some((v) => v.tripId === d.id)
  );

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end gap-4 rounded-xl border border-haidee-border bg-white p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">日期 Date</label>
          <DateInputField value={date} onChange={updateDate} />
        </div>
        <Button
          onClick={() => startTransition(() => syncFees())}
          disabled={syncing || isPending}
          className="gap-2 bg-haidee-blue text-white hover:bg-haidee-blue/90"
        >
          {syncing || isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          生成/刷新费用
        </Button>
        {loading && (
          <span className="flex items-center gap-1 text-sm text-haidee-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载中…
          </span>
        )}
      </div>

      {error && (
        <p className="no-print rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Module 1: Upah Turun */}
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
                        triggerPrint({ type: "unloading", tripId: group.tripId })
                      }
                    >
                      <Printer className="h-3.5 w-3.5" />
                      打印
                    </Button>
                  </div>
                  {expanded && (
                    <ScrollMatrixTable heightOffset={360} className="border-0 rounded-none">
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
                                    row.unloadFeeOverride != null && "text-orange-600"
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
                                  <Badge variant="secondary" className="text-haidee-muted">
                                    免收
                                  </Badge>
                                ) : (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className={cn(
                                      "ml-auto h-8 w-24 text-right font-mono text-sm",
                                      row.kpbFeeOverride != null && "text-orange-600"
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

      {/* Module 2: Upah Naik Tong */}
      <ModuleCard title="Module 2 — Upah Naik Tong（上桶费）">
        {loadingGroups.length === 0 ? (
          <p className="text-sm text-haidee-muted">此日期暂无上桶费记录</p>
        ) : (
          <div className="space-y-4">
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
                <ScrollMatrixTable heightOffset={400} className="border-0 rounded-none">
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
                                row.loadingFeeOverride != null && "text-orange-600"
                              )}
                              defaultValue={effectiveLoadingFee(row)}
                              key={`load-${row.id}-${row.loadingFeeOverride}`}
                              onBlur={(e) => patchLoadingFee(row.id, e.target.value)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollMatrixTable>
              </div>
            ))}
          </div>
        )}
      </ModuleCard>

      {/* Module 3: Driver Voucher */}
      <ModuleCard title="Module 3 — Driver Voucher（司机报销单）">
        <div className="no-print mb-4">
          <Button onClick={openNewVoucherDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            新增 Add New
          </Button>
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
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-sm">{v.voucherNo}</TableCell>
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
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => openEditVoucher(v)}
                        >
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1"
                          onClick={() =>
                            triggerPrint({ type: "voucher", id: v.id })
                          }
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollMatrixTable>
        )}
      </ModuleCard>

      {/* Voucher dialog */}
      <Dialog open={voucherDialogOpen} onOpenChange={setVoucherDialogOpen}>
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingVoucher ? "编辑报销单 Edit Voucher" : "新增报销单 New Voucher"}
            </DialogTitle>
          </DialogHeader>
          {!voucherForm ? (
            <div className="space-y-3">
              <label className="text-sm font-medium">选择趟次 Select trip</label>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {(editingVoucher ? dispatches : voucherTripsWithoutVoucher).length ===
                0 ? (
                  <p className="text-sm text-haidee-muted">无可用趟次</p>
                ) : (
                  (editingVoucher ? dispatches : voucherTripsWithoutVoucher).map(
                    (d) => (
                      <button
                        key={d.id}
                        type="button"
                        disabled={voucherSaving}
                        onClick={() => prepareVoucherForTrip(d.id)}
                        className="flex w-full items-center gap-2 rounded-lg border border-haidee-border px-3 py-2 text-left text-sm hover:bg-haidee-surface/50"
                      >
                        <span className="font-medium">{d.lorry}</span>
                        <span className="text-haidee-muted">{d.driver}</span>
                        <span className="text-haidee-muted">{d.route}</span>
                      </button>
                    )
                  )
                )}
              </div>
              {voucherSaving && (
                <div className="flex items-center gap-2 text-sm text-haidee-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载建议金额…
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-haidee-muted">单号</span>
                  <div className="font-mono">{voucherForm.voucherNo}</div>
                </div>
                <div>
                  <span className="text-haidee-muted">罗里</span>
                  <div>{voucherForm.lorry}</div>
                </div>
                <div>
                  <span className="text-haidee-muted">司机</span>
                  <div>{voucherForm.driverName}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm font-medium">
                <div>项目 Item</div>
                <div className="text-right">系统建议 Suggested</div>
                <div className="text-right">实际 Actual</div>
              </div>
              {(
                [
                  ["Chop/Border", "chopBorderAmt", "chopBorderActual"],
                  ["Parking", "parkingAmt", "parkingActual"],
                  ["KPB", "kpbAmt", "kpbActual"],
                  ["Fish Check", "fishCheckAmt", "fishCheckActual"],
                  ["Upah Turun", "upahTurunAmt", "upahTurunActual"],
                  ["Upah Naik Tong", "upahNaikTongAmt", "upahNaikTongActual"],
                ] as const
              ).map(([label, amtKey, actualKey]) => (
                <div key={amtKey} className="grid grid-cols-3 items-center gap-3">
                  <label className="text-sm">{label}</label>
                  <Input
                    readOnly
                    className="text-right font-mono bg-muted/50"
                    value={voucherForm[amtKey]}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    className="text-right font-mono"
                    value={voucherForm[actualKey]}
                    onChange={(e) =>
                      setVoucherForm((prev) =>
                        prev ? { ...prev, [actualKey]: e.target.value } : prev
                      )
                    }
                  />
                </div>
              ))}
              <div className="grid grid-cols-3 items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="minyakMoto"
                    checked={voucherForm.minyakMotoEnabled}
                    onChange={(e) =>
                      setVoucherForm((prev) =>
                        prev
                          ? { ...prev, minyakMotoEnabled: e.target.checked }
                          : prev
                      )
                    }
                  />
                  <label htmlFor="minyakMoto" className="text-sm">
                    Minyak Moto
                  </label>
                </div>
                <Input
                  readOnly
                  className="text-right font-mono bg-muted/50"
                  value={voucherForm.minyakMotoAmt}
                />
                <Input
                  type="number"
                  step="0.01"
                  className="text-right font-mono"
                  value={voucherForm.minyakMotoActual}
                  disabled={!voucherForm.minyakMotoEnabled}
                  onChange={(e) =>
                    setVoucherForm((prev) =>
                      prev ? { ...prev, minyakMotoActual: e.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-3 border-t pt-3">
                <label className="text-sm font-semibold">Duit Jalan（路费）</label>
                <div />
                <Input
                  type="number"
                  step="0.01"
                  className="text-right font-mono font-semibold"
                  value={voucherForm.duitJalan}
                  onChange={(e) =>
                    setVoucherForm((prev) =>
                      prev ? { ...prev, duitJalan: e.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="flex justify-between rounded-lg bg-haidee-surface/40 px-4 py-3 text-sm">
                <span>
                  Belanja（支出）:{" "}
                  <span className="font-mono font-semibold">
                    {formatMyr(voucherBelanja)}
                  </span>
                </span>
                <span>
                  Baki（余额）:{" "}
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      voucherBaki != null && voucherBaki >= 0 && "text-green-600",
                      voucherBaki != null && voucherBaki < 0 && "text-red-600"
                    )}
                  >
                    {voucherBaki != null ? formatMyr(voucherBaki) : "—"}
                  </span>
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoucherDialogOpen(false)}>
              取消
            </Button>
            {voucherForm && (
              <Button onClick={saveVoucher} disabled={voucherSaving}>
                {voucherSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "保存 Save"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print areas */}
      {printUnloadingGroup && (
        <div className="driver-expense-print-area hidden print:block">
          <div className="print-title">Upah Turun — {printUnloadingGroup.lorry}</div>
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
                  <td className="text-right">{formatMyr(lineSubtotal(row))}</td>
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

      {printVoucher && (
        <div className="driver-expense-print-area hidden print:block">
          <div className="print-title">
            海利物流有限公司 HAI DEE LOGISTICS CO., LTD
          </div>
          <div className="print-title" style={{ fontSize: "14px" }}>
            司机报销单 Driver Voucher
          </div>
          <table style={{ marginBottom: "12px", border: "none" }}>
            <tbody>
              <tr>
                <td style={{ border: "none" }}>单号: {printVoucher.voucherNo}</td>
                <td style={{ border: "none" }}>日期: {date}</td>
              </tr>
              <tr>
                <td style={{ border: "none" }}>罗里: {printVoucher.lorry}</td>
                <td style={{ border: "none" }}>
                  司机: {printVoucher.driverName}
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ border: "none" }}>
                  路线: {printVoucher.route}
                </td>
              </tr>
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <th>项目 Item</th>
                <th>建议 Suggested</th>
                <th>实际 Actual</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Chop/Border", printVoucher.chopBorderAmt, printVoucher.chopBorderActual],
                  ["Parking", printVoucher.parkingAmt, printVoucher.parkingActual],
                  ["KPB", printVoucher.kpbAmt, printVoucher.kpbActual],
                  ["Fish Check", printVoucher.fishCheckAmt, printVoucher.fishCheckActual],
                  ["Upah Turun", printVoucher.upahTurunAmt, printVoucher.upahTurunActual],
                  [
                    "Upah Naik Tong",
                    printVoucher.upahNaikTongAmt,
                    printVoucher.upahNaikTongActual,
                  ],
                ] as const
              ).map(([label, amt, actual]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="text-right">
                    {amt != null ? formatMyr(amt) : "—"}
                  </td>
                  <td className="text-right">
                    {actual != null ? formatMyr(actual) : "—"}
                  </td>
                </tr>
              ))}
              {printVoucher.minyakMotoEnabled && (
                <tr>
                  <td>Minyak Moto</td>
                  <td className="text-right">
                    {formatMyr(printVoucher.minyakMotoAmt)}
                  </td>
                  <td className="text-right">
                    {printVoucher.minyakMotoActual != null
                      ? formatMyr(printVoucher.minyakMotoActual)
                      : "—"}
                  </td>
                </tr>
              )}
              <tr>
                <td className="font-bold">Duit Jalan</td>
                <td />
                <td className="text-right font-bold">
                  {printVoucher.duitJalan != null
                    ? formatMyr(printVoucher.duitJalan)
                    : "—"}
                </td>
              </tr>
              <tr>
                <td className="font-bold">Belanja</td>
                <td />
                <td className="text-right font-bold">
                  {printVoucher.belanja != null
                    ? formatMyr(printVoucher.belanja)
                    : "—"}
                </td>
              </tr>
              <tr>
                <td className="font-bold">Baki</td>
                <td />
                <td className="text-right font-bold">
                  {printVoucher.baki != null
                    ? formatMyr(printVoucher.baki)
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
