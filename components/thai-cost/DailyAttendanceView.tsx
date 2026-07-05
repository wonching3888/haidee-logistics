"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteThaiDailyAttendance,
  getThaiHolidayRateInfo,
  saveThaiDailyAttendance,
  saveThaiDailyLaborRoster,
  type ThaiDailyAttendanceRow,
  type ThaiDailyLaborRosterRow,
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
  DEFAULT_LUNCH_ALLOWANCE_THB,
  DEFAULT_SADAO_DAILY_WAGE_THB,
  SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT,
  SUGGESTED_SADAO_HOLIDAY_DAILY_WAGE_THB,
  THAI_COST_STATION_LABELS,
  THAI_COST_STATIONS,
  type ThaiCostStation,
} from "@/lib/constants/thai-cost";
import { formatDisplay } from "@/lib/date-utils";
import type { HolidayRateInfo } from "@/lib/thai-cost/holiday";

interface DailyAttendanceViewProps {
  year: number;
  month: number;
  rows: ThaiDailyAttendanceRow[];
  roster: ThaiDailyLaborRosterRow | null;
  canWrite: boolean;
}

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function isTotalPaidStation(station: ThaiCostStation) {
  return station === "SONGKHLA";
}

export function DailyAttendanceView({
  year,
  month,
  rows,
  roster,
  canWrite,
}: DailyAttendanceViewProps) {
  const router = useRouter();
  const { t, tLocal, locale } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [rosterCount, setRosterCount] = useState(
    String(roster?.rosterCount ?? SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT)
  );
  const [rosterNotes, setRosterNotes] = useState(roster?.notes ?? "");
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    station: "SADAO" as ThaiCostStation,
    attendanceCount: String(SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT),
    dailyWage: String(DEFAULT_SADAO_DAILY_WAGE_THB),
    totalWagePaid: "",
    notes: "",
  });
  const [holidayInfo, setHolidayInfo] = useState<HolidayRateInfo | null>(null);

  const formUsesTotalPaid = isTotalPaidStation(form.station);

  useEffect(() => {
    if (!showForm || !form.date || formUsesTotalPaid) {
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
  }, [showForm, form.date, formUsesTotalPaid]);

  function openCreate() {
    setEditId(undefined);
    setForm({
      date: `${year}-${String(month).padStart(2, "0")}-01`,
      station: "SADAO",
      attendanceCount: String(
        roster?.rosterCount ?? SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT
      ),
      dailyWage: String(DEFAULT_SADAO_DAILY_WAGE_THB),
      totalWagePaid: "",
      notes: "",
    });
    setShowForm(true);
    setError(null);
  }

  function openEdit(row: ThaiDailyAttendanceRow) {
    setEditId(row.id);
    setForm({
      date: row.date,
      station: row.station,
      attendanceCount: String(row.attendanceCount),
      dailyWage: String(row.dailyWage),
      totalWagePaid:
        row.totalWagePaid != null ? String(row.totalWagePaid) : "",
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
        setError(
          e instanceof Error ? e.message : tLocal("thaiCost.common.operationFailed")
        );
      }
    });
  }

  function changeMonth(nextYear: number, nextMonth: number) {
    router.push(`/thai-cost/attendance?year=${nextYear}&month=${nextMonth}`);
  }

  const monthTotal = rows.reduce((s, r) => s + r.dayCostThb, 0);
  const lunchTotal =
    (roster?.rosterCount ?? 0) * DEFAULT_LUNCH_ALLOWANCE_THB;

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        {tLocal("thaiCost.attendance.intro", {
          lunch: String(DEFAULT_LUNCH_ALLOWANCE_THB),
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
            {tLocal("thaiCost.attendance.addRecord")}
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-haidee-border bg-haidee-surface/50 p-4">
        <h3 className="text-sm font-medium">
          {tLocal("thaiCost.attendance.rosterTitle")}
        </h3>
        <p className="mt-1 text-xs text-haidee-muted">
          {tLocal("thaiCost.attendance.rosterHint", {
            lunch: String(DEFAULT_LUNCH_ALLOWANCE_THB),
          })}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span>{tLocal("thaiCost.attendance.rosterCount")}</span>
            <Input
              type="number"
              min={0}
              step={1}
              className="w-28"
              value={rosterCount}
              disabled={!canWrite}
              onChange={(e) => setRosterCount(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{tLocal("thaiCost.common.notes")}</span>
            <Input
              className="w-72"
              value={rosterNotes}
              disabled={!canWrite}
              onChange={(e) => setRosterNotes(e.target.value)}
              placeholder={tLocal("thaiCost.attendance.rosterNotesPlaceholder")}
            />
          </label>
          {canWrite && (
            <Button
              type="button"
              disabled={isPending}
              className="bg-haidee-blue text-white"
              onClick={() =>
                run(async () => {
                  await saveThaiDailyLaborRoster({
                    year,
                    month,
                    station: "SADAO",
                    rosterCount: Number(rosterCount),
                    notes: rosterNotes || null,
                  });
                })
              }
            >
              {tLocal("thaiCost.attendance.saveRoster")}
            </Button>
          )}
          <div className="text-sm">
            {tLocal("thaiCost.attendance.lunchTotal")}{" "}
            <span className="font-mono font-medium">{money(lunchTotal)}</span>
          </div>
        </div>
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
              if (isTotalPaidStation(form.station)) {
                await saveThaiDailyAttendance({
                  id: editId,
                  date: form.date,
                  station: form.station,
                  attendanceCount: Number(form.attendanceCount),
                  dailyWage: 0,
                  totalWagePaid: Number(form.totalWagePaid),
                  notes: form.notes || null,
                });
              } else {
                await saveThaiDailyAttendance({
                  id: editId,
                  date: form.date,
                  station: form.station,
                  attendanceCount: Number(form.attendanceCount),
                  dailyWage: Number(form.dailyWage),
                  totalWagePaid: null,
                  notes: form.notes || null,
                });
              }
            });
          }}
        >
          <label className="space-y-1 text-sm">
            <span>{t("thaiCost.common.date")}</span>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("thaiCost.common.station")}</span>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={form.station}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  station: e.target.value as ThaiCostStation,
                }))
              }
            >
              {THAI_COST_STATIONS.map((s) => (
                <option key={s} value={s}>
                  {THAI_COST_STATION_LABELS[s][locale]} {s}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>{tLocal("thaiCost.attendance.headcount")}</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.attendanceCount}
              onChange={(e) =>
                setForm((f) => ({ ...f, attendanceCount: e.target.value }))
              }
              required
            />
          </label>
          {formUsesTotalPaid ? (
            <label className="space-y-1 text-sm">
              <span>{tLocal("thaiCost.attendance.totalPaid")}</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.totalWagePaid}
                onChange={(e) =>
                  setForm((f) => ({ ...f, totalWagePaid: e.target.value }))
                }
                required
              />
            </label>
          ) : (
            <label className="space-y-1 text-sm">
              <span>{tLocal("thaiCost.attendance.dailyWage")}</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.dailyWage}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dailyWage: e.target.value }))
                }
                required
              />
            </label>
          )}
          {holidayInfo?.isHolidayRate && !formUsesTotalPaid && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2 lg:col-span-3">
              {tLocal("thaiCost.attendance.holidayWarning")}
              {holidayInfo.reason === "sunday" &&
                tLocal("thaiCost.attendance.sunday")}
              {holidayInfo.reason === "public_holiday" &&
                `${tLocal("thaiCost.attendance.publicHoliday")}${
                  holidayInfo.holidayName ? `：${holidayInfo.holidayName}` : ""
                }）`}
              {tLocal("thaiCost.attendance.holidayPriceHint", {
                amount: String(SUGGESTED_SADAO_HOLIDAY_DAILY_WAGE_THB),
              })}
            </div>
          )}
          {formUsesTotalPaid && (
            <p className="text-xs text-haidee-muted sm:col-span-2 lg:col-span-3">
              {tLocal("thaiCost.attendance.songkhlaTotalHint")}
            </p>
          )}
          <label className="space-y-1 text-sm sm:col-span-2">
            <span>{t("thaiCost.common.notes")}</span>
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
              <TableHead>{tLocal("thaiCost.common.station")}</TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.attendance.colHeadcount")}
              </TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.attendance.colRateOrPaid")}
              </TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.attendance.colDayCost")}
              </TableHead>
              <TableHead>{tLocal("thaiCost.common.notes")}</TableHead>
              {canWrite && (
                <TableHead className="text-right">
                  {tLocal("thaiCost.common.actions")}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 7 : 6}
                  className="py-8 text-center text-haidee-muted"
                >
                  {tLocal("thaiCost.attendance.noRecords")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDisplay(r.date)}</TableCell>
                  <TableCell>
                    {THAI_COST_STATION_LABELS[r.station][locale]} ({r.station})
                  </TableCell>
                  <TableCell className="text-right">{r.attendanceCount}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {r.totalWagePaid != null
                      ? `${tLocal("thaiCost.attendance.paidLabel")} ${money(r.totalWagePaid)}`
                      : `${tLocal("thaiCost.attendance.rateLabel")} ${money(r.dailyWage)}`}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(r.dayCostThb)}
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
                          if (
                            !confirm(
                              tLocal("thaiCost.attendance.deleteConfirm", {
                                date: formatDisplay(r.date),
                              })
                            )
                          )
                            return;
                          run(async () => {
                            await deleteThaiDailyAttendance(r.id);
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
              <TableRow className="bg-haidee-surface/50 font-medium">
                <TableCell colSpan={4}>
                  {tLocal("thaiCost.attendance.monthTotal")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {money(monthTotal)}
                </TableCell>
                <TableCell colSpan={canWrite ? 2 : 1} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
