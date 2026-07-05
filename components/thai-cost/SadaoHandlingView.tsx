"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import {
  deleteSadaoHandling,
  getSadaoDispatchTotalsForDate,
  getThaiHolidayRateInfo,
  saveSadaoHandling,
  type SadaoHandlingRow,
} from "@/app/actions/thai-cost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getSadaoHandlingRates,
  SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB,
  SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB,
  SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB,
  SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB,
} from "@/lib/constants/thai-cost";
import { formatDisplay } from "@/lib/date-utils";
import type { HolidayRateInfo } from "@/lib/thai-cost/holiday";

interface SadaoHandlingViewProps {
  year: number;
  month: number;
  rows: SadaoHandlingRow[];
  canWrite: boolean;
}

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function SadaoHandlingView({
  year,
  month,
  rows,
  canWrite,
}: SadaoHandlingViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [showDirect, setShowDirect] = useState(false);
  const [dispatchTotals, setDispatchTotals] = useState({
    smallCrateTotalQty: 0,
    largeCrateTotalQty: 0,
    boxTotalQty: 0,
  });
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    smallCrateNoCheckQty: "0",
    largeCrateNoCheckQty: "0",
    boxNoCheckQty: "0",
    notes: "",
  });
  const [holidayInfo, setHolidayInfo] = useState<HolidayRateInfo | null>(null);

  useEffect(() => {
    if (!showForm || !form.date) {
      setHolidayInfo(null);
      return;
    }
    let cancelled = false;
    getThaiHolidayRateInfo(form.date)
      .then((info) => {
        if (!cancelled) setHolidayInfo(info);
      })
      .catch(() => {
        if (!cancelled) setHolidayInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showForm, form.date]);

  useEffect(() => {
    if (!showForm || !form.date) return;
    let cancelled = false;
    setLoadingDispatch(true);
    getSadaoDispatchTotalsForDate(form.date)
      .then((totals) => {
        if (!cancelled) setDispatchTotals(totals);
      })
      .catch(() => {
        if (!cancelled) {
          setDispatchTotals({
            smallCrateTotalQty: 0,
            largeCrateTotalQty: 0,
            boxTotalQty: 0,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDispatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showForm, form.date]);

  function openCreate() {
    setEditId(undefined);
    setShowDirect(false);
    setForm({
      date: `${year}-${String(month).padStart(2, "0")}-01`,
      smallCrateNoCheckQty: "0",
      largeCrateNoCheckQty: "0",
      boxNoCheckQty: "0",
      notes: "",
    });
    setShowForm(true);
    setError(null);
  }

  function openEdit(row: SadaoHandlingRow) {
    setEditId(row.id);
    const hasDirect =
      row.smallCrateNoCheckQty > 0 ||
      row.largeCrateNoCheckQty > 0 ||
      row.boxNoCheckQty > 0;
    setShowDirect(hasDirect);
    setForm({
      date: row.date,
      smallCrateNoCheckQty: String(row.smallCrateNoCheckQty),
      largeCrateNoCheckQty: String(row.largeCrateNoCheckQty),
      boxNoCheckQty: String(row.boxNoCheckQty),
      notes: row.notes ?? "",
    });
    setShowForm(true);
    setError(null);
  }

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setShowForm(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function changeMonth(nextYear: number, nextMonth: number) {
    router.push(
      `/thai-cost/sadao-handling?year=${nextYear}&month=${nextMonth}`
    );
  }

  const monthTotal = rows.reduce((s, r) => s + r.commissionThb, 0);
  const smallTotal = rows.reduce((s, r) => s + r.smallCommissionThb, 0);
  const largeTotal = rows.reduce((s, r) => s + r.largeCommissionThb, 0);
  const boxTotal = rows.reduce((s, r) => s + r.boxCommissionThb, 0);

  const billablePreview = {
    small:
      dispatchTotals.smallCrateTotalQty -
      (Number(form.smallCrateNoCheckQty) || 0),
    large:
      dispatchTotals.largeCrateTotalQty -
      (Number(form.largeCrateNoCheckQty) || 0),
    box:
      dispatchTotals.boxTotalQty - (Number(form.boxNoCheckQty) || 0),
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        Sadao 每日搬运：总数自动从派车数据汇总（全部 assigned，含宋卡/北大年/Sadao
        提货点）。计费数 = 总数 − 直达数。平日费率小桶/盒子{" "}
        {SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB}、大桶{" "}
        {SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB}；假日（星期日/公众假期）小桶/盒子{" "}
        {SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB}、大桶{" "}
        {SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB}。
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>年</span>
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => changeMonth(Number(e.target.value) || year, month)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>月</span>
          <Input
            type="number"
            min={1}
            max={12}
            className="w-20"
            value={month}
            onChange={(e) => changeMonth(year, Number(e.target.value) || month)}
          />
        </label>
        {canWrite && (
          <Button
            type="button"
            className="gap-2 bg-haidee-blue text-white"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            录入搬运
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {showForm && canWrite && (
        <form
          className="space-y-3 rounded-lg border border-haidee-border bg-haidee-surface/50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await saveSadaoHandling({
                id: editId,
                date: form.date,
                smallCrateNoCheckQty: Number(form.smallCrateNoCheckQty),
                largeCrateNoCheckQty: Number(form.largeCrateNoCheckQty),
                boxNoCheckQty: Number(form.boxNoCheckQty),
                notes: form.notes || null,
              });
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span>日期 Date</span>
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                required
              />
            </label>
          </div>

          {holidayInfo?.isHolidayRate && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              今天是假日费率
              {holidayInfo.reason === "sunday" && "（星期日）"}
              {holidayInfo.reason === "public_holiday" &&
                `（公众假期${holidayInfo.holidayName ? `：${holidayInfo.holidayName}` : ""}）`}
              。将自动套用：小桶/盒子 {getSadaoHandlingRates(true).small}、大桶{" "}
              {getSadaoHandlingRates(true).large} THB。
            </div>
          )}
          {holidayInfo && !holidayInfo.isHolidayRate && (
            <div className="rounded-md bg-haidee-surface px-3 py-2 text-sm text-haidee-muted">
              平日费率：小桶/盒子 {getSadaoHandlingRates(false).small}、大桶{" "}
              {getSadaoHandlingRates(false).large} THB。
            </div>
          )}

          <div className="rounded-md border border-haidee-border bg-white p-3">
            <p className="text-sm font-medium">派车自动总数（只读）</p>
            {loadingDispatch ? (
              <p className="mt-2 text-sm text-haidee-muted">加载派车数据…</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div className="text-sm">
                  <span className="text-haidee-muted">小桶 </span>
                  <span className="font-mono font-medium">
                    {dispatchTotals.smallCrateTotalQty}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-haidee-muted">大桶 </span>
                  <span className="font-mono font-medium">
                    {dispatchTotals.largeCrateTotalQty}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-haidee-muted">盒子 </span>
                  <span className="font-mono font-medium">
                    {dispatchTotals.boxTotalQty}
                  </span>
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-haidee-muted">
              计费预览：小 {billablePreview.small} / 大 {billablePreview.large}{" "}
              / 盒 {billablePreview.box}
            </p>
          </div>

          <div className="rounded-md border border-dashed border-haidee-border">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-haidee-surface/50"
              onClick={() => setShowDirect((v) => !v)}
            >
              {showDirect ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {showDirect ? "直达" : "+ 添加直达记录"}
            </button>
            {showDirect && (
              <div className="grid gap-3 border-t border-haidee-border p-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span>直达 · 小桶</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={form.smallCrateNoCheckQty}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        smallCrateNoCheckQty: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>直达 · 大桶</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={form.largeCrateNoCheckQty}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        largeCrateNoCheckQty: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>直达 · 盒子</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={form.boxNoCheckQty}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, boxNoCheckQty: e.target.value }))
                    }
                    required
                  />
                </label>
              </div>
            )}
          </div>

          <label className="block space-y-1 text-sm">
            <span>备注</span>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="可选，如直达原因"
            />
          </label>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-haidee-blue text-white"
            >
              保存
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setShowForm(false)}
            >
              取消
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-haidee-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>日期</TableHead>
              <TableHead>费率</TableHead>
              <TableHead className="text-right">小桶 总/直达/计费</TableHead>
              <TableHead className="text-right">大桶 总/直达/计费</TableHead>
              <TableHead className="text-right">盒子 总/直达/计费</TableHead>
              <TableHead className="text-right">提成 (THB)</TableHead>
              <TableHead>备注</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-haidee-muted">
                  该月暂无搬运记录
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDisplay(r.date)}</TableCell>
                  <TableCell className="text-sm">
                    {r.holidayRate ? "假日" : "平日"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {r.smallCrateTotalQty} / {r.smallCrateNoCheckQty} /{" "}
                    {r.smallBillableQty}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {r.largeCrateTotalQty} / {r.largeCrateNoCheckQty} /{" "}
                    {r.largeBillableQty}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {r.boxTotalQty} / {r.boxNoCheckQty} / {r.boxBillableQty}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(r.commissionThb)}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate">
                    {r.notes ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/thai-cost/sadao-voucher?date=${r.date}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-haidee-surface"
                      title="打印 Voucher"
                    >
                      <Printer className="h-4 w-4" />
                    </Link>
                    {canWrite && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            if (
                              !confirm(`删除 ${formatDisplay(r.date)} 搬运？`)
                            )
                              return;
                            run(async () => {
                              await deleteSadaoHandling(r.id);
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-haidee-red" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
            {rows.length > 0 && (
              <>
                <TableRow className="bg-haidee-surface/30 text-sm">
                  <TableCell colSpan={5}>小桶提成小计</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(smallTotal)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
                <TableRow className="bg-haidee-surface/30 text-sm">
                  <TableCell colSpan={5}>大桶提成小计</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(largeTotal)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
                <TableRow className="bg-haidee-surface/30 text-sm">
                  <TableCell colSpan={5}>盒子提成小计</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(boxTotal)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
                <TableRow className="bg-haidee-surface/50 font-medium">
                  <TableCell colSpan={5}>当月提成合计</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(monthTotal)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
