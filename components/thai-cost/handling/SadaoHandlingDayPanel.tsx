"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Printer, Trash2 } from "lucide-react";
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
  getSadaoHandlingRates,
  SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB,
  SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB,
  SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB,
  SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB,
} from "@/lib/constants/thai-cost";
import type { HolidayRateInfo } from "@/lib/thai-cost/holiday";
import type { SadaoHandlingOtherExpenseInput } from "@/lib/thai-cost/sadao-handling-expenses";
import { HandlingHistoryLink } from "@/components/thai-cost/handling/HandlingHistoryLink";

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

function otherExpensesFromRow(row: SadaoHandlingRow): OtherExpenseFormRow[] {
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

function formFromRow(row: SadaoHandlingRow | null) {
  if (!row) {
    return {
      smallCrateNoCheckQty: "0",
      largeCrateNoCheckQty: "0",
      boxNoCheckQty: "0",
      notes: "",
    };
  }
  return {
    smallCrateNoCheckQty: String(row.smallCrateNoCheckQty),
    largeCrateNoCheckQty: String(row.largeCrateNoCheckQty),
    boxNoCheckQty: String(row.boxNoCheckQty),
    notes: row.notes ?? "",
  };
}

export function SadaoHandlingDayPanel({
  date,
  existingRow,
  canWrite,
}: {
  date: string;
  existingRow: SadaoHandlingRow | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { tLocal } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | undefined>(existingRow?.id);
  const [showDirect, setShowDirect] = useState(false);
  const [dispatchTotals, setDispatchTotals] = useState({
    smallCrateTotalQty: 0,
    largeCrateTotalQty: 0,
    boxTotalQty: 0,
  });
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [form, setForm] = useState(formFromRow(existingRow));
  const [holidayInfo, setHolidayInfo] = useState<HolidayRateInfo | null>(null);
  const [otherExpenses, setOtherExpenses] = useState<OtherExpenseFormRow[]>(
    existingRow ? otherExpensesFromRow(existingRow) : []
  );

  useEffect(() => {
    setEditId(existingRow?.id);
    setForm(formFromRow(existingRow));
    setOtherExpenses(
      existingRow ? otherExpensesFromRow(existingRow) : []
    );
    const hasDirect = existingRow
      ? existingRow.smallCrateNoCheckQty > 0 ||
        existingRow.largeCrateNoCheckQty > 0 ||
        existingRow.boxNoCheckQty > 0
      : false;
    setShowDirect(hasDirect);
    setError(null);
  }, [date, existingRow]);

  useEffect(() => {
    if (!date) {
      setHolidayInfo(null);
      return;
    }
    let cancelled = false;
    getThaiHolidayRateInfo(date)
      .then((info) => {
        if (!cancelled) setHolidayInfo(info);
      })
      .catch(() => {
        if (!cancelled) setHolidayInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoadingDispatch(true);
    getSadaoDispatchTotalsForDate(date)
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
  }, [date]);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : tLocal("thaiCost.common.operationFailed")
        );
      }
    });
  }

  const billablePreview = {
    small:
      dispatchTotals.smallCrateTotalQty -
      (Number(form.smallCrateNoCheckQty) || 0),
    large:
      dispatchTotals.largeCrateTotalQty -
      (Number(form.largeCrateNoCheckQty) || 0),
    box: dispatchTotals.boxTotalQty - (Number(form.boxNoCheckQty) || 0),
  };

  return (
    <section className="space-y-3 rounded-lg border border-haidee-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">
          {tLocal("thaiCost.dailyOverview.sadaoTitle")}
        </h3>
        {existingRow && (
          <Link
            href={`/thai-cost/sadao-voucher?date=${date}`}
            className="inline-flex items-center gap-1 text-sm text-haidee-blue underline"
          >
            <Printer className="h-4 w-4" />
            {tLocal("thaiCost.sadaoHandling.printVoucher")}
          </Link>
        )}
      </div>
      <p className="text-sm text-haidee-muted">
        {tLocal("thaiCost.sadaoHandling.intro", {
          smallW: String(SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB),
          largeW: String(SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB),
          smallH: String(SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB),
          largeH: String(SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB),
        })}
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {existingRow && !canWrite && (
        <div className="rounded-md bg-haidee-surface/60 p-3 text-sm">
          <p>
            {tLocal("thaiCost.handling.savedDayTotal")}:{" "}
            <span className="font-mono font-medium">
              {existingRow.dayTotalThb.toFixed(2)}
            </span>
          </p>
        </div>
      )}

      {canWrite && (
        <form
          className="space-y-3 rounded-lg border border-haidee-border bg-haidee-surface/50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await saveSadaoHandling({
                id: editId,
                date,
                smallCrateNoCheckQty: Number(form.smallCrateNoCheckQty),
                largeCrateNoCheckQty: Number(form.largeCrateNoCheckQty),
                boxNoCheckQty: Number(form.boxNoCheckQty),
                notes: form.notes || null,
                otherExpenses: otherExpensesToInput(otherExpenses),
              });
            });
          }}
        >
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

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-haidee-blue text-white"
            >
              {tLocal("thaiCost.common.save")}
            </Button>
            {existingRow && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  if (
                    !confirm(
                      tLocal("thaiCost.sadaoHandling.deleteConfirm", { date })
                    )
                  )
                    return;
                  run(async () => {
                    await deleteSadaoHandling(existingRow.id);
                  });
                }}
              >
                {tLocal("thaiCost.common.delete")}
              </Button>
            )}
          </div>
        </form>
      )}

      <HandlingHistoryLink station="sadao" date={date} />
    </section>
  );
}
