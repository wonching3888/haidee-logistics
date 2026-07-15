"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  getThaiDriverTripSettlementTodos,
  getThaiHandlingSettlementTodos,
  getThaiSettlementPendingConfirm,
  settleThaiDriverTripDayAction,
  settleThaiDriverTripDaysBulkAction,
  settleThaiHandlingDayAction,
  settleThaiHandlingDaysBulkAction,
} from "@/app/actions/thai-cash-book-settlement";
import type {
  ThaiDriverTripTodoItem,
  ThaiHandlingTodoItem,
  ThaiSettlementPendingConfirmItem,
} from "@/lib/cash-book/thai-cash-book-settlement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WideTableScrollArea } from "@/components/shared/WideTableScrollArea";
import { formatDisplay } from "@/lib/date-utils";

function money(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function stationLabel(station: ThaiHandlingTodoItem["station"]) {
  if (station === "SADAO") return "SADAO";
  if (station === "SONGKHLA") return "宋卡";
  return "北大年";
}

export function ThaiCashBookSettlementView({ canWrite }: { canWrite: boolean }) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = now.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
  const [handling, setHandling] = useState<ThaiHandlingTodoItem[]>([]);
  const [trips, setTrips] = useState<ThaiDriverTripTodoItem[]>([]);
  const [pending, setPending] = useState<ThaiSettlementPendingConfirmItem[]>(
    []
  );
  const [selectedHandling, setSelectedHandling] = useState<Set<string>>(
    new Set()
  );
  const [selectedTrips, setSelectedTrips] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlingKey(row: ThaiHandlingTodoItem) {
    return `${row.station}:${row.id}`;
  }

  function reload() {
    startTransition(async () => {
      setError(null);
      try {
        const [h, t, p] = await Promise.all([
          getThaiHandlingSettlementTodos({ fromDate, toDate }),
          getThaiDriverTripSettlementTodos({ fromDate, toDate }),
          getThaiSettlementPendingConfirm({ fromDate, toDate }),
        ]);
        setHandling(h);
        setTrips(t);
        setPending(p);
        setSelectedHandling(new Set());
        setSelectedTrips(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + explicit Reload
  }, []);

  function settleOneHandling(row: ThaiHandlingTodoItem) {
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const result = await settleThaiHandlingDayAction({
        station: row.station,
        id: row.id,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `已生成草稿 ${result.voucherNo}（${stationLabel(row.station)} ${row.date}）— 请在「待确认」核对后确认`
      );
      reload();
    });
  }

  function settleOneTrip(row: ThaiDriverTripTodoItem) {
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const result = await settleThaiDriverTripDayAction({ id: row.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `已生成草稿 ${result.voucherNo}（${row.driverName} ${row.date}）— 请在「待确认」核对后确认`
      );
      reload();
    });
  }

  function settleHandlingBulk() {
    const items = handling
      .filter((row) => selectedHandling.has(handlingKey(row)))
      .map((row) => ({ station: row.station, id: row.id }));
    if (items.length === 0) return;
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const result = await settleThaiHandlingDaysBulkAction({ items });
      setMessage(
        `搬运费草稿 ${result.settled.length} 笔` +
          (result.errors.length ? `，失败 ${result.errors.length}` : "") +
          " — 请在「待确认」核对后确认"
      );
      if (result.errors[0]) setError(result.errors[0].error);
      reload();
    });
  }

  function settleTripBulk() {
    const ids = trips
      .filter((row) => selectedTrips.has(row.id))
      .map((row) => row.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const result = await settleThaiDriverTripDaysBulkAction({ ids });
      setMessage(
        `趋次草稿 ${result.settled.length} 笔` +
          (result.errors.length ? `，失败 ${result.errors.length}` : "") +
          " — 请在「待确认」核对后确认"
      );
      if (result.errors[0]) setError(result.errors[0].error);
      reload();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-haidee-muted">From</span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-haidee-muted">To</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => reload()}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          查询 Reload
        </Button>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-haidee-text">
              待确认 Pending confirm
            </h2>
            <p className="text-sm text-haidee-muted">
              已关联日表的草稿 PV。打开编辑页勾选「确认/已审核」后才计入账本。
            </p>
          </div>
        </div>
        <WideTableScrollArea heightOffset={260} pinFirstColumn={false}>
          <TableHeader>
            <TableRow>
              <TableHead>凭证号 No.</TableHead>
              <TableHead>日期 Date</TableHead>
              <TableHead>来源 Source</TableHead>
              <TableHead>付给 Paid To</TableHead>
              <TableHead className="text-right">金额 Amount</TableHead>
              <TableHead>说明 Particulars</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-haidee-muted">
                  暂无待确认草稿 No pending draft PVs
                </TableCell>
              </TableRow>
            ) : (
              pending.map((row) => (
                <TableRow key={row.paymentVoucherId}>
                  <TableCell className="font-mono text-sm">
                    {row.voucherNo}
                  </TableCell>
                  <TableCell>{formatDisplay(row.voucherDate)}</TableCell>
                  <TableCell>
                    {row.sourceLabel}
                    <span className="ml-1 text-xs text-haidee-muted">
                      ({formatDisplay(row.sourceDate)})
                    </span>
                  </TableCell>
                  <TableCell>{row.paidTo}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(row.totalAmount)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {row.particulars ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/financial/cash-book/payment-voucher/${row.paymentVoucherId}/edit`}
                      className="text-sm text-haidee-blue underline"
                    >
                      打开编辑 Edit
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </WideTableScrollArea>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-haidee-text">
              搬运费待办 Handling (6502)
            </h2>
            <p className="text-sm text-haidee-muted">
              仅 SADAO + 宋卡（不含北大年）。SADAO 仅佣金，不含其他开销。生成即草稿，须人工确认入账。
            </p>
          </div>
          {canWrite && (
            <Button
              type="button"
              disabled={isPending || selectedHandling.size === 0}
              onClick={() => settleHandlingBulk()}
            >
              批量生成草稿 Selected ({selectedHandling.size})
            </Button>
          )}
        </div>
        <WideTableScrollArea heightOffset={260} pinFirstColumn={false}>
          <TableHeader>
            <TableRow>
              {canWrite && <TableHead className="w-10" />}
              <TableHead>日期 Date</TableHead>
              <TableHead>站点 Station</TableHead>
              <TableHead className="text-right">金额 Amount</TableHead>
              <TableHead>说明 Particulars</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {handling.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 6 : 5}
                  className="text-haidee-muted"
                >
                  暂无未结账搬运费 No unsettled handling rows
                </TableCell>
              </TableRow>
            ) : (
              handling.map((row) => {
                const key = handlingKey(row);
                return (
                  <TableRow key={key}>
                    {canWrite && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedHandling.has(key)}
                          onChange={(e) => {
                            setSelectedHandling((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(key);
                              else next.delete(key);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell>{formatDisplay(row.date)}</TableCell>
                    <TableCell>{stationLabel(row.station)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(row.amountThb)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {row.particulars}
                    </TableCell>
                    <TableCell>
                      {canWrite && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPending}
                          onClick={() => settleOneHandling(row)}
                        >
                          生成草稿 PV
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </WideTableScrollArea>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-haidee-text">
              司机趋次待办 Trip wages (6500)
            </h2>
            <p className="text-sm text-haidee-muted">
              按日期+司机（宋卡+北大年同日合计）。金额仅为趋次工资；待命津贴须人工开凭证。含「其他」替补司机。生成即草稿。
            </p>
          </div>
          {canWrite && (
            <Button
              type="button"
              disabled={isPending || selectedTrips.size === 0}
              onClick={() => settleTripBulk()}
            >
              批量生成草稿 Selected ({selectedTrips.size})
            </Button>
          )}
        </div>
        <WideTableScrollArea heightOffset={260} pinFirstColumn={false}>
          <TableHeader>
            <TableRow>
              {canWrite && <TableHead className="w-10" />}
              <TableHead>日期 Date</TableHead>
              <TableHead>司机 Driver</TableHead>
              <TableHead className="text-right">宋卡</TableHead>
              <TableHead className="text-right">北大年</TableHead>
              <TableHead className="text-right">金额 Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 7 : 6}
                  className="text-haidee-muted"
                >
                  暂无未结账趋次 No unsettled trip rows
                </TableCell>
              </TableRow>
            ) : (
              trips.map((row) => (
                <TableRow key={row.id}>
                  {canWrite && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedTrips.has(row.id)}
                        onChange={(e) => {
                          setSelectedTrips((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell>{formatDisplay(row.date)}</TableCell>
                  <TableCell>{row.driverName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.songkhlaTripCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.pattaniTripCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {money(row.amountThb)}
                  </TableCell>
                  <TableCell>
                    {canWrite && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending}
                        onClick={() => settleOneTrip(row)}
                      >
                        生成草稿 PV
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </WideTableScrollArea>
      </section>

      <p className="text-sm text-haidee-muted">
        草稿确认后可在{" "}
        <Link
          href="/financial/cash-book/ledger/thb"
          className="text-haidee-blue underline"
        >
          THB 账本明细
        </Link>{" "}
        /{" "}
        <Link
          href="/financial/cash-book/payment-voucher"
          className="text-haidee-blue underline"
        >
          付款凭证
        </Link>{" "}
        查看。北大年搬运费与 SADAO「其他开销」不在此自动结账，请人工开凭证。
      </p>
    </div>
  );
}
