"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteSadaoHandling,
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
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    smallCrateTotalQty: "",
    largeCrateTotalQty: "",
    boxTotalQty: "0",
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

  function openCreate() {
    setEditId(undefined);
    setForm({
      date: `${year}-${String(month).padStart(2, "0")}-01`,
      smallCrateTotalQty: "",
      largeCrateTotalQty: "",
      boxTotalQty: "0",
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
    setForm({
      date: row.date,
      smallCrateTotalQty: String(row.smallCrateTotalQty),
      largeCrateTotalQty: String(row.largeCrateTotalQty),
      boxTotalQty: String(row.boxTotalQty),
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        Sadao 每日搬运：计费数 = 总数 − 不过车数。平日费率小桶/盒子{" "}
        {SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB}、大桶{" "}
        {SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB}；假日（星期日/公众假期）小桶/盒子{" "}
        {SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB}、大桶{" "}
        {SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB}。费率保存时自动套用，无需手动选档。
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
          className="grid gap-3 rounded-lg border border-haidee-border bg-haidee-surface/50 p-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await saveSadaoHandling({
                id: editId,
                date: form.date,
                smallCrateTotalQty: Number(form.smallCrateTotalQty),
                largeCrateTotalQty: Number(form.largeCrateTotalQty),
                boxTotalQty: Number(form.boxTotalQty),
                smallCrateNoCheckQty: Number(form.smallCrateNoCheckQty),
                largeCrateNoCheckQty: Number(form.largeCrateNoCheckQty),
                boxNoCheckQty: Number(form.boxNoCheckQty),
                notes: form.notes || null,
              });
            });
          }}
        >
          <label className="space-y-1 text-sm">
            <span>日期 Date</span>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </label>
          {holidayInfo?.isHolidayRate && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2 lg:col-span-3">
              今天是假日费率
              {holidayInfo.reason === "sunday" && "（星期日）"}
              {holidayInfo.reason === "public_holiday" &&
                `（公众假期${holidayInfo.holidayName ? `：${holidayInfo.holidayName}` : ""}）`}
              。将自动套用：小桶/盒子{" "}
              {getSadaoHandlingRates(true).small}、大桶{" "}
              {getSadaoHandlingRates(true).large} THB。
            </div>
          )}
          {holidayInfo && !holidayInfo.isHolidayRate && (
            <div className="rounded-md bg-haidee-surface px-3 py-2 text-sm text-haidee-muted sm:col-span-2 lg:col-span-3">
              平日费率：小桶/盒子 {getSadaoHandlingRates(false).small}、大桶{" "}
              {getSadaoHandlingRates(false).large} THB。
            </div>
          )}
          <label className="space-y-1 text-sm">
            <span>小桶总数</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.smallCrateTotalQty}
              onChange={(e) =>
                setForm((f) => ({ ...f, smallCrateTotalQty: e.target.value }))
              }
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>大桶总数</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.largeCrateTotalQty}
              onChange={(e) =>
                setForm((f) => ({ ...f, largeCrateTotalQty: e.target.value }))
              }
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>盒子总数</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.boxTotalQty}
              onChange={(e) =>
                setForm((f) => ({ ...f, boxTotalQty: e.target.value }))
              }
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>不过车小桶</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.smallCrateNoCheckQty}
              onChange={(e) =>
                setForm((f) => ({ ...f, smallCrateNoCheckQty: e.target.value }))
              }
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>不过车大桶</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.largeCrateNoCheckQty}
              onChange={(e) =>
                setForm((f) => ({ ...f, largeCrateNoCheckQty: e.target.value }))
              }
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>不过车盒子</span>
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
          <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-3">
            <span>备注（如不过车原因）</span>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
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
              <TableHead className="text-right">小桶 总/不过车/计费</TableHead>
              <TableHead className="text-right">大桶 总/不过车/计费</TableHead>
              <TableHead className="text-right">盒子 总/不过车/计费</TableHead>
              <TableHead className="text-right">提成 (THB)</TableHead>
              <TableHead>备注</TableHead>
              {canWrite && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 8 : 7}
                  className="py-8 text-center text-haidee-muted"
                >
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
                  {canWrite && (
                    <TableCell className="text-right">
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
                          if (!confirm(`删除 ${formatDisplay(r.date)} 搬运？`))
                            return;
                          run(async () => {
                            await deleteSadaoHandling(r.id);
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-haidee-red" />
                      </Button>
                    </TableCell>
                  )}
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
                  <TableCell colSpan={canWrite ? 2 : 1} />
                </TableRow>
                <TableRow className="bg-haidee-surface/30 text-sm">
                  <TableCell colSpan={5}>大桶提成小计</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(largeTotal)}
                  </TableCell>
                  <TableCell colSpan={canWrite ? 2 : 1} />
                </TableRow>
                <TableRow className="bg-haidee-surface/30 text-sm">
                  <TableCell colSpan={5}>盒子提成小计</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(boxTotal)}
                  </TableCell>
                  <TableCell colSpan={canWrite ? 2 : 1} />
                </TableRow>
                <TableRow className="bg-haidee-surface/50 font-medium">
                  <TableCell colSpan={5}>当月提成合计</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(monthTotal)}
                  </TableCell>
                  <TableCell colSpan={canWrite ? 2 : 1} />
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
