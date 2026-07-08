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
import { useT } from "@/components/shared/locale-context";
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
import type { SadaoHandlingOtherExpenseInput } from "@/lib/thai-cost/sadao-handling-expenses";

interface SadaoHandlingViewProps {
  year: number;
  month: number;
  rows: SadaoHandlingRow[];
  canWrite: boolean;
}

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

type OtherExpenseFormRow = {
  key: string;
  description: string;
  amountThb: string;
};

function emptyOtherExpenseRow(): OtherExpenseFormRow {
  return {
    key: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    amountThb: "",
  };
}

function otherExpensesFromRow(
  row: SadaoHandlingRow
): OtherExpenseFormRow[] {
  if (row.otherExpenses.length === 0) return [];
  return row.otherExpenses.map((item) => ({
    key: item.id,
    description: item.description,
    amountThb: String(item.amountThb),
  }));
}

function otherExpensesToInput(
  rows: OtherExpenseFormRow[]
): SadaoHandlingOtherExpenseInput[] {
  return rows
    .filter((row) => row.description.trim() || row.amountThb.trim())
    .map((row) => ({
      description: row.description,
      amountThb: Number(row.amountThb) || 0,
    }));
}

export function SadaoHandlingView({
  year,
  month,
  rows,
  canWrite,
}: SadaoHandlingViewProps) {
  const router = useRouter();
  const { t, tLocal } = useT();
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
  const [otherExpenses, setOtherExpenses] = useState<OtherExpenseFormRow[]>([]);

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
    setOtherExpenses([]);
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
    setOtherExpenses(otherExpensesFromRow(row));
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
        setError(
          e instanceof Error ? e.message : tLocal("thaiCost.common.operationFailed")
        );
      }
    });
  }

  function changeMonth(nextYear: number, nextMonth: number) {
    router.push(
      `/thai-cost/sadao-handling?year=${nextYear}&month=${nextMonth}`
    );
  }

  const monthTotal = rows.reduce((s, r) => s + r.dayTotalThb, 0);
  const smallTotal = rows.reduce((s, r) => s + r.smallCommissionThb, 0);
  const largeTotal = rows.reduce((s, r) => s + r.largeCommissionThb, 0);
  const boxTotal = rows.reduce((s, r) => s + r.boxCommissionThb, 0);
  const otherTotal = rows.reduce((s, r) => s + r.otherExpensesThb, 0);
  const commissionTotal = rows.reduce((s, r) => s + r.commissionThb, 0);

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
        {tLocal("thaiCost.sadaoHandling.intro", {
          smallW: String(SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB),
          largeW: String(SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB),
          smallH: String(SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB),
          largeH: String(SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB),
        })}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>{tLocal("thaiCost.common.year")}</span>
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => changeMonth(Number(e.target.value) || year, month)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>{tLocal("thaiCost.common.month")}</span>
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
            {tLocal("thaiCost.sadaoHandling.addRecord")}
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
                otherExpenses: otherExpensesToInput(otherExpenses),
              });
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span>{t("thaiCost.common.date")}</span>
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
              {tLocal("thaiCost.sadaoHandling.todayHoliday")}
              {holidayInfo.reason === "sunday" &&
                tLocal("thaiCost.attendance.sunday")}
              {holidayInfo.reason === "public_holiday" &&
                `${tLocal("thaiCost.attendance.publicHoliday")}${
                  holidayInfo.holidayName ? `：${holidayInfo.holidayName}` : ""
                }）`}
              {tLocal("thaiCost.sadaoHandling.autoApply", {
                small: String(getSadaoHandlingRates(true).small),
                large: String(getSadaoHandlingRates(true).large),
              })}
            </div>
          )}
          {holidayInfo && !holidayInfo.isHolidayRate && (
            <div className="rounded-md bg-haidee-surface px-3 py-2 text-sm text-haidee-muted">
              {tLocal("thaiCost.sadaoHandling.weekdayRates", {
                small: String(getSadaoHandlingRates(false).small),
                large: String(getSadaoHandlingRates(false).large),
              })}
            </div>
          )}

          <div className="rounded-md border border-haidee-border bg-white p-3">
            <p className="text-sm font-medium">
              {tLocal("thaiCost.sadaoHandling.dispatchTotals")}
            </p>
            {loadingDispatch ? (
              <p className="mt-2 text-sm text-haidee-muted">
                {tLocal("thaiCost.sadaoHandling.loadingDispatch")}
              </p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div className="text-sm">
                  <span className="text-haidee-muted">
                    {tLocal("thaiCost.sadaoHandling.smallCrate")}{" "}
                  </span>
                  <span className="font-mono font-medium">
                    {dispatchTotals.smallCrateTotalQty}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-haidee-muted">
                    {tLocal("thaiCost.sadaoHandling.largeCrate")}{" "}
                  </span>
                  <span className="font-mono font-medium">
                    {dispatchTotals.largeCrateTotalQty}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-haidee-muted">
                    {tLocal("thaiCost.common.box")}{" "}
                  </span>
                  <span className="font-mono font-medium">
                    {dispatchTotals.boxTotalQty}
                  </span>
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-haidee-muted">
              {tLocal("thaiCost.sadaoHandling.billablePreview", {
                small: String(billablePreview.small),
                large: String(billablePreview.large),
                box: String(billablePreview.box),
              })}
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
              {showDirect
                ? tLocal("thaiCost.sadaoHandling.direct")
                : tLocal("thaiCost.sadaoHandling.addDirect")}
            </button>
            {showDirect && (
              <div className="grid gap-3 border-t border-haidee-border p-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span>{tLocal("thaiCost.sadaoHandling.directSmall")}</span>
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
                  <span>{tLocal("thaiCost.sadaoHandling.directLarge")}</span>
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
                  <span>{tLocal("thaiCost.sadaoHandling.directBox")}</span>
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

          <div className="rounded-md border border-dashed border-haidee-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {tLocal("thaiCost.sadaoHandling.otherExpenses")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setOtherExpenses((rows) => [...rows, emptyOtherExpenseRow()])
                }
              >
                <Plus className="h-4 w-4" />
                {tLocal("thaiCost.sadaoHandling.addOtherExpense")}
              </Button>
            </div>
            {otherExpenses.length === 0 ? (
              <p className="mt-2 text-xs text-haidee-muted">
                {tLocal("thaiCost.sadaoHandling.otherExpensesEmpty")}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {otherExpenses.map((row) => (
                  <div
                    key={row.key}
                    className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]"
                  >
                    <label className="space-y-1 text-sm">
                      <span>
                        {tLocal("thaiCost.sadaoHandling.otherExpenseDescription")}
                      </span>
                      <Input
                        value={row.description}
                        onChange={(e) =>
                          setOtherExpenses((rows) =>
                            rows.map((item) =>
                              item.key === row.key
                                ? { ...item, description: e.target.value }
                                : item
                            )
                          )
                        }
                        placeholder={tLocal(
                          "thaiCost.sadaoHandling.otherExpenseDescription"
                        )}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span>
                        {tLocal("thaiCost.sadaoHandling.otherExpenseAmount")}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.amountThb}
                        onChange={(e) =>
                          setOtherExpenses((rows) =>
                            rows.map((item) =>
                              item.key === row.key
                                ? { ...item, amountThb: e.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setOtherExpenses((rows) =>
                            rows.filter((item) => item.key !== row.key)
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-haidee-red" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="block space-y-1 text-sm">
            <span>{tLocal("thaiCost.common.notes")}</span>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={tLocal("thaiCost.sadaoHandling.notesPlaceholder")}
            />
          </label>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-haidee-blue text-white"
            >
              {tLocal("thaiCost.common.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setShowForm(false)}
            >
              {tLocal("thaiCost.common.cancel")}
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-haidee-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>{tLocal("thaiCost.common.date")}</TableHead>
              <TableHead>{tLocal("thaiCost.sadaoHandling.colRate")}</TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.sadaoHandling.colSmallTotals")}
              </TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.sadaoHandling.colLargeTotals")}
              </TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.sadaoHandling.colBoxTotals")}
              </TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.sadaoHandling.colDayTotal")}
              </TableHead>
              <TableHead>{tLocal("thaiCost.common.notes")}</TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.common.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-haidee-muted">
                  {tLocal("thaiCost.sadaoHandling.noRecords")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDisplay(r.date)}</TableCell>
                  <TableCell className="text-sm">
                    {r.holidayRate
                      ? tLocal("thaiCost.common.holiday")
                      : tLocal("thaiCost.common.weekday")}
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
                    <div>{money(r.dayTotalThb)}</div>
                    {r.otherExpensesThb > 0 && (
                      <div className="text-xs text-haidee-muted">
                        {money(r.commissionThb)}+{money(r.otherExpensesThb)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate">
                    {r.notes ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/thai-cost/sadao-voucher?date=${r.date}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-haidee-surface"
                      title={tLocal("thaiCost.sadaoHandling.printVoucher")}
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
                              !confirm(
                                tLocal("thaiCost.sadaoHandling.deleteConfirm", {
                                  date: formatDisplay(r.date),
                                })
                              )
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
                  <TableCell colSpan={5}>
                    {tLocal("thaiCost.sadaoHandling.subtotalSmall")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(smallTotal)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
                <TableRow className="bg-haidee-surface/30 text-sm">
                  <TableCell colSpan={5}>
                    {tLocal("thaiCost.sadaoHandling.subtotalLarge")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(largeTotal)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
                <TableRow className="bg-haidee-surface/30 text-sm">
                  <TableCell colSpan={5}>
                    {tLocal("thaiCost.sadaoHandling.subtotalBox")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(boxTotal)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
                <TableRow className="bg-haidee-surface/30 text-sm">
                  <TableCell colSpan={5}>
                    {tLocal("thaiCost.sadaoHandling.subtotalOther")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(otherTotal)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
                <TableRow className="bg-haidee-surface/30 text-sm">
                  <TableCell colSpan={5}>
                    {tLocal("thaiCost.sadaoHandling.monthTotal")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(commissionTotal)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
                <TableRow className="bg-haidee-surface/50 font-medium">
                  <TableCell colSpan={5}>
                    {tLocal("thaiCost.sadaoHandling.monthDayTotal")}
                  </TableCell>
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
