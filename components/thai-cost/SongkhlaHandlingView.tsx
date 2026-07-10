"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteSongkhlaHandling,
  getStationDispatchTotalsForDate,
  saveSongkhlaHandling,
  type SongkhlaHandlingRow,
} from "@/app/actions/thai-cost-phase2";
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
import { formatDisplay } from "@/lib/date-utils";

export function SongkhlaHandlingView({
  year,
  month,
  rows,
  canWrite,
  historyOnly = false,
}: {
  year: number;
  month: number;
  rows: SongkhlaHandlingRow[];
  canWrite: boolean;
  historyOnly?: boolean;
}) {
  const router = useRouter();
  const { tLocal } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [dispatchTotals, setDispatchTotals] = useState({
    smallCrateTotalQty: 0,
    largeCrateTotalQty: 0,
    boxTotalQty: 0,
  });
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    notes: "",
  });

  useEffect(() => {
    if (!showForm || !form.date) return;
    let cancelled = false;
    setLoadingDispatch(true);
    getStationDispatchTotalsForDate(form.date, "SONGKHLA")
      .then((totals) => {
        if (!cancelled) {
          setDispatchTotals({
            smallCrateTotalQty: totals.smallCrateTotalQty,
            largeCrateTotalQty: totals.largeCrateTotalQty,
            boxTotalQty: totals.boxTotalQty,
          });
        }
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

  return (
    <div className="space-y-4">
      {!historyOnly && (
        <p className="text-sm text-haidee-muted">
          {tLocal("thaiCost.songkhlaHandling.intro")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Input
          type="number"
          className="w-24"
          value={year}
          onChange={(e) =>
            router.push(
              `/thai-cost/songkhla-handling?year=${Number(e.target.value) || year}&month=${month}`
            )
          }
        />
        <Input
          type="number"
          className="w-20"
          min={1}
          max={12}
          value={month}
          onChange={(e) =>
            router.push(
              `/thai-cost/songkhla-handling?year=${year}&month=${Number(e.target.value) || month}`
            )
          }
        />
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}
      {canWrite && !historyOnly && !showForm && (
        <Button
          type="button"
          className="gap-1 bg-haidee-blue text-white"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" />{" "}
          {tLocal("thaiCost.songkhlaHandling.addRecord")}
        </Button>
      )}
      {canWrite && !historyOnly && showForm && (
        <form
          className="space-y-3 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await saveSongkhlaHandling({
                  date: form.date,
                  manualQty: false,
                  notes: form.notes || null,
                });
                setShowForm(false);
                router.refresh();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : tLocal("thaiCost.common.failed")
                );
              }
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              {tLocal("thaiCost.common.date")}
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              {tLocal("thaiCost.common.notes")}
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="rounded-md bg-haidee-surface/60 px-3 py-2 text-sm">
            <p className="font-medium text-haidee-text">
              {tLocal("thaiCost.songkhlaHandling.dispatchTotals")}
            </p>
            {loadingDispatch ? (
              <p className="text-haidee-muted">
                {tLocal("thaiCost.common.loading")}
              </p>
            ) : (
              <p className="font-mono">
                {tLocal("thaiCost.dailyOverview.billableBreakdown", {
                  small: String(dispatchTotals.smallCrateTotalQty),
                  large: String(dispatchTotals.largeCrateTotalQty),
                  box: String(dispatchTotals.boxTotalQty),
                })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isPending || loadingDispatch}
              className="bg-haidee-blue text-white"
            >
              {tLocal("thaiCost.common.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              {tLocal("thaiCost.common.cancel")}
            </Button>
          </div>
        </form>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tLocal("thaiCost.common.date")}</TableHead>
            <TableHead className="text-right">
              {tLocal("thaiCost.songkhlaHandling.colCrateTotals")}
            </TableHead>
            <TableHead className="text-right">
              {tLocal("thaiCost.songkhlaHandling.colBoxTotals")}
            </TableHead>
            <TableHead className="text-right">
              {tLocal("thaiCost.songkhlaHandling.colCommission")}
            </TableHead>
            {canWrite && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatDisplay(r.date)}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {r.crateBillableQty}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {r.boxBillableQty}
              </TableCell>
              <TableCell className="text-right font-mono">
                <div>{r.commissionThb.toFixed(2)}</div>
                <div className="text-xs text-haidee-muted">
                  {r.crateCommissionThb.toFixed(2)}+{r.boxCommissionThb.toFixed(2)}
                </div>
              </TableCell>
              {canWrite && (
                <TableCell>
                  {historyOnly && (
                    <Link
                      href={`/thai-cost/handling?date=${r.date}`}
                      className="mr-2 text-sm text-haidee-blue underline"
                    >
                      {tLocal("thaiCost.handling.historyBannerLink")}
                    </Link>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteSongkhlaHandling(r.id);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-haidee-red" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
